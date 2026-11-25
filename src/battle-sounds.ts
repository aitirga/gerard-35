import { isCastle } from './castle.ts';
import { isOnion, type BattleEffect, type BattleState, type Element, type ElementReaction, type FoeKind, type SkillId } from './battle.ts';
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
  // Sincopante: its ecos sing with Marta's voice as they are called (the beats sing from the scene, `ecoNews`).
  ostinato: { start: [{ id: 'cast-soft' }], impact: [{ id: 'clink' }, { id: 'eco-fa', delay: .6 }] },
  bordon: { start: [{ id: 'cast-soft' }], impact: [{ id: 'heal' }, { id: 'eco-la', delay: .6 }] },
  crescendo: { start: [{ id: 'rise', volume: .5 }], impact: [{ id: 'eco-fa', volume: .8 }, { id: 'eco-la', volume: .8, delay: .05 }, { id: 'eco-do', volume: .8, delay: .1 }] },
  acompanamiento: { start: [{ id: 'cast-soft' }], impact: [{ id: 'eco-do', delay: .4 }] },
  tutti: { start: [{ id: 'rise', volume: .6 }], impact: [{ id: 'clink' }, { id: 'eco-fa', volume: 1.3 }, { id: 'eco-la', volume: 1.3 }, { id: 'eco-do', volume: 1.3 }] },
  'da-capo': { start: [{ id: 'eco-dacapo' }], impact: [{ id: 'heal', volume: .6, delay: .8 }] },
  punado: { impact: [{ id: 'hit', volume: .55 }] },
  // Colorista's powder is dry and soft: a muffled thud, never a ring. The screens are a boost (`stat-up` from the scene).
  cortina: { start: [{ id: 'cast-soft', volume: .6 }], impact: [] },
  telon: { start: [{ id: 'cast-soft', volume: .7 }], impact: [] },
  rociada: { start: [{ id: 'cast-soft' }], impact: [{ id: 'splash', volume: .7 }] },
  polvareda: { impact: [{ id: 'hit', volume: .5 }, { id: 'hit', volume: .4, delay: .1 }, { id: 'hit', volume: .35, delay: .2 }] },
  // Traca's first puff lands here, the rest from the scene.
  traca: { impact: [{ id: 'hit', volume: .5 }] },
  'fin-de-fiesta': { start: [{ id: 'rise', volume: .5 }], impact: [{ id: 'hit', volume: .6 }, { id: 'fire-hit', delay: .35 }, { id: 'splash', delay: .8 }, { id: 'zap', delay: 1.25 }] },
  // Freática's water is low and close, heard as under water: a mark rising is a swell, not a splash; the current a
  // bolt that sinks into it; the water hammer a pipe's knock, once a mark (the rest from the scene); the ice a crack and a sink.
  recarga: { start: [{ id: 'cast-soft', volume: .5 }], impact: [{ id: 'rise', volume: .55 }, { id: 'splash', volume: .35, delay: .3 }] },
  sondeo: { start: [{ id: 'charge', volume: .4 }], impact: [{ id: 'zap' }, { id: 'sink', volume: .5, delay: .12 }] },
  bombeo: { start: [{ id: 'sink', volume: .5 }], impact: [{ id: 'heal' }, { id: 'splash', volume: .3, delay: .1 }] },
  riada: { start: [{ id: 'rise', volume: .6 }], impact: [{ id: 'splash' }, { id: 'splash', volume: .6, delay: .25 }] },
  'golpe-de-ariete': { start: [{ id: 'charge', volume: .35 }], impact: [{ id: 'thump' }, { id: 'splash', volume: .5, delay: .05 }] },
  'bajo-cero': { start: [{ id: 'rise', volume: .5 }], impact: [{ id: 'crack', volume: .7 }, { id: 'glass-tick', delay: .15 }, { id: 'sink', volume: .5, delay: .3 }] },
  'foc-binari': { start: [{ id: 'fire-cast' }], impact: [{ id: 'fire-hit' }] },
  // A boost's stats going up sound on their own (`stat-up`, from the scene).
  analisis: { start: [{ id: 'think' }], impact: [] },
  cardioide: { start: [{ id: 'cast-soft' }], impact: [{ id: 'heal' }] },
  // Serie de Fourier: additive synthesis. Its first strike is a pure sine; each strike after it, from the scene, adds the next partial.
  fourier: { start: [{ id: 'think' }], impact: [{ id: 'partial-1' }, { id: 'hit', volume: .35 }] },
  // Haru miaows as she goes; her claws are what land. Zarpazos' first claw lands here, the rest from the scene.
  zarpazo: { start: [{ id: 'meow' }], impact: [{ id: 'claw' }, { id: 'hit', volume: .45 }] },
  zarpazos: { start: [{ id: 'meow' }], impact: [{ id: 'claw' }] },
  llaga: { start: [{ id: 'meow' }], impact: [{ id: 'claw-deep' }] },
  // Acecho: crouching makes no sound but a creak of the floor; its pounce, as the round starts, lands deep (from the scene).
  acecho: { start: [{ id: 'creak', volume: .35 }], impact: [] },
  // Cacería's first claw lands here, the rest from the scene; Siete vidas' too, and a rise as Yuki's ward settles.
  caceria: { start: [{ id: 'meow' }, { id: 'meow-soft', delay: .12 }], impact: [{ id: 'claw' }] },
  'siete-vidas': { start: [{ id: 'meow' }, { id: 'meow-soft', delay: .1 }], impact: [{ id: 'claw-deep' }, { id: 'rise', volume: .4, delay: .25 }] },
  angulo: { start: [{ id: 'think' }], impact: [] },
  ronroneo: { start: [{ id: 'meow-soft' }], impact: [{ id: 'heal' }] },
  // Tecnópata's are Bip's: it charges up and fires, blows up, or hums its waves.
  'rayo-energia': { start: [{ id: 'charge', volume: .45 }], impact: [{ id: 'zap' }, { id: 'hit', volume: .4 }] },
  'rayo-sanacion': { start: [{ id: 'cast-soft' }], impact: [{ id: 'heal' }] },
  explosion: { start: [{ id: 'charge', volume: .6 }], impact: [{ id: 'fire-hit' }, { id: 'slam' }, { id: 'crack', volume: .5, delay: .05 }] },
  confusion: { start: [{ id: 'think', volume: .7 }], impact: [{ id: 'glitch' }] },
  'bomba-remota': { start: [{ id: 'charge', volume: .4 }], impact: [{ id: 'clink', volume: .7 }, { id: 'glitch', volume: .4, delay: .15 }] },
  escolta: { start: [{ id: 'charge', volume: .4 }], impact: [{ id: 'guard' }, { id: 'clink', volume: .5, delay: .1 }] },
  enjambre: { start: [{ id: 'rise', volume: .5 }], impact: [{ id: 'glitch' }, { id: 'clink', volume: .6, delay: .3 }, { id: 'zap', delay: .6 }] },
  'rayo-encogedor': { start: [{ id: 'charge', volume: .4 }], impact: [{ id: 'zap', volume: .6 }, { id: 'sink' }] },
  // Matemágico's elements: fire forking to everyone, water rising to one level, a bolt out of the sky.
  'factor-comun': { start: [{ id: 'fire-cast' }], impact: [{ id: 'fire-hit' }, { id: 'burn', delay: .08 }] },
  integral: { start: [{ id: 'think' }], impact: [{ id: 'heal' }, { id: 'clink', volume: .5, delay: .15 }] },
  // Atractor extraño: a low hum that trembles as the attractor does and falls as ρ does, from the butterfly's first stroke to the
  // collapse (FIGURES.atractor), and one note struck as everything lands in the foe's chest.
  atractor: { start: [{ id: 'think' }, { id: 'chaos-hum', delay: .45 }], impact: [{ id: 'struck' }, { id: 'thump', volume: .45 }] },
  vasos: { start: [{ id: 'cast-soft' }], impact: [{ id: 'splash' }, { id: 'splash', volume: .6, delay: .12 }] },
  descarga: { start: [{ id: 'charge', volume: .5 }], impact: [{ id: 'zap' }, { id: 'crack', volume: .6 }, { id: 'hit', volume: .4, delay: .03 }] },
  // Cortocircuito: a resistor that snaps: a crack, the zap, and a dull thud as the current stays in them.
  cortocircuito: { start: [{ id: 'think' }], impact: [{ id: 'crack' }, { id: 'zap', delay: .04 }, { id: 'thump', volume: .5, delay: .08 }] },
  // ∂Q/∂t Condensador: the sum worked out, then the charge humming up into him.
  condensador: { start: [{ id: 'think' }], impact: [{ id: 'charge', volume: .55 }, { id: 'clink', volume: .4, delay: .2 }] },
  // Superficie mínima: the film drawn between the rings rings like glass, wet; it settles round the ally with a soft guard.
  // Its burst (a pop and the drops flung off) is the scene's, when a blow reaches it.
  'superficie-minima': { start: [{ id: 'think' }, { id: 'film-shimmer', delay: .45 }], impact: [{ id: 'guard', volume: .55 }, { id: 'film-shimmer', volume: .45, delay: .05 }] },
  // Bip's signal takes; the foe's own blow lands from the scene.
  'control-remoto': { start: [{ id: 'think', volume: .7 }], impact: [{ id: 'glitch' }, { id: 'zap', volume: .4, delay: .1 }] },
  virus: { start: [{ id: 'charge', volume: .4 }], impact: [{ id: 'glitch' }, { id: 'zap', volume: .35, delay: .06 }, { id: 'glitch', volume: .5, delay: .18 }] },
  'escudo-de-bits': { start: [{ id: 'charge', volume: .5 }], impact: [{ id: 'mana' }, { id: 'clink', volume: .6, delay: .1 }] },
  reinicio: { start: [{ id: 'charge', volume: .5 }], impact: [{ id: 'glitch', volume: .6 }, { id: 'zap', volume: .5, delay: .08 }, { id: 'clink', volume: .5, delay: .2 }] },
  // Dadista's faces are dice thrown: they click as they leave the hand and land with their weight
  // (the brackets more softly: they land on a friend).
  // Tirar dado itself never lands: its die's face does (`effect.skill` is the face's move).
  'tirar-dado': { start: [], impact: [] },
  'cara-mano': { start: [{ id: 'clink', volume: .6 }], impact: [{ id: 'hit' }, { id: 'thump', volume: .6 }] },
  // The Comodín: a brighter clink, and the blow on everyone.
  'cara-comodin': { start: [{ id: 'clink', volume: .9 }], impact: [{ id: 'hit' }, { id: 'thump', volume: .8 }] },
  'cara-tijeras': { start: [{ id: 'clink', volume: .6 }], impact: [{ id: 'hit' }, { id: 'thump', volume: .4 }] },
  'cara-ojo': { start: [{ id: 'clink', volume: .6 }], impact: [{ id: 'hit', volume: .7 }] },
  'cara-corchete': { start: [{ id: 'clink', volume: .6 }], impact: [{ id: 'guard' }] },
  // Agitar never lands (it is not an action: the fight's interface clicks the dice itself).
  agitar: { start: [], impact: [] },
  // Estrella fugaz: the die leaves with its click and lands as light, high and soft.
  'estrella-fugaz': { start: [{ id: 'clink', volume: .7 }, { id: 'cast-soft', volume: .6 }], impact: [{ id: 'mana' }, { id: 'hit', volume: .5 }] },
  // The rain's own dice sound as they land (the scene plays each one); these are the call and the first.
  'dados-astrales': { start: [{ id: 'clink', volume: .7 }, { id: 'rise', volume: .5 }], impact: [{ id: 'mana' }, { id: 'hit', volume: .45 }] },
  'ases-en-duo': { start: [{ id: 'clink', volume: .7 }, { id: 'clink', volume: .7, delay: .12 }], impact: [{ id: 'glass-tick' }, { id: 'stat-up', delay: .1 }] },
  meteorito: { start: [{ id: 'cast-soft', volume: .6 }], impact: [{ id: 'thump' }, { id: 'mana', volume: .7 }] },
  meteoro: { start: [{ id: 'charge', volume: .5 }], impact: [{ id: 'slam' }, { id: 'thump', delay: .04 }, { id: 'mana', volume: .7 }] },
  asteroide: { start: [{ id: 'charge', volume: .8 }, { id: 'roar', volume: .3, delay: .2 }], impact: [{ id: 'slam' }, { id: 'crack', delay: .05 }, { id: 'thump', delay: .1 }, { id: 'mana', delay: .2 }] },
};
const ELEMENT_SOUNDS: Record<Element, Cue> = { agua: { id: 'splash', volume: .5 }, fuego: { id: 'fire-hit', volume: .45 }, electrico: { id: 'zap', volume: .6 } };
const REACTION_SOUNDS: Record<ElementReaction, Cue[]> = { humo: [{ id: 'fizzle', delay: .04 }], cauterizado: [{ id: 'burn', delay: .04 }], tormenta: [{ id: 'zap', delay: .05 }, { id: 'zap', delay: .13 }], vapor: [{ id: 'fizzle', delay: .04 }], conduccion: [{ id: 'zap', delay: .05 }, { id: 'zap', volume: .7, delay: .14 }], plasma: [{ id: 'zap', delay: .04 }, { id: 'fire-hit', delay: .1 }, { id: 'burn', delay: .2 }], estallido: [{ id: 'fire-hit', delay: .04 }, { id: 'burn', delay: .16 }], veneno: [{ id: 'fizzle', delay: .04 }], cristal: [{ id: 'zap', delay: .05 }] };
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
  // La Sobremesa: dice on the table, a lunge, chalk, a card slapped down, a voice out of tune, a shield.
  'sobremesa-alvaro': { start: [{ id: 'creak', volume: .5 }], impact: [{ id: 'thump' }] },
  'sobremesa-anna': { impact: [{ id: 'hit' }] },
  'sobremesa-sarah': { impact: [{ id: 'mark-set' }] },
  'sobremesa-miquel': { impact: [{ id: 'slam' }] },
  'sobremesa-joan': { start: [{ id: 'glitch', volume: .6 }], impact: [{ id: 'hit', volume: .8 }] },
  'sobremesa-soraya': { impact: [{ id: 'stat-up', volume: .7 }] },
  'sobremesa-nico': { impact: [{ id: 'guard' }] },
  // Càmping Eurocamping: gas hissing into a flare, a die falling flat, card on bone, a plaster fist.
  mago: { start: [{ id: 'charge', volume: .5 }], impact: [{ id: 'fire-hit' }] },
  dado: { start: [{ id: 'creak', volume: .4 }], impact: [{ id: 'thump' }] },
  agente: { impact: [{ id: 'hit' }] },
  campeon: { impact: [{ id: 'slam' }] },
  // Las cuerdas: a body thrown in the way, a blow repeated, light off glass, a line drawn, a voice.
  lealtad: { impact: [{ id: 'slam', volume: .8 }] },
  eco: { impact: [{ id: 'hit', volume: .7 }] },
  cristalino: { start: [{ id: 'charge', volume: .4 }], impact: [{ id: 'crack', volume: .7 }] },
  directo: { start: [{ id: 'gust', volume: .5 }], impact: [{ id: 'slam' }] },
  voz: { impact: [{ id: 'hit', volume: .8 }] },
  // The castle: gum that lands heavy, a ruler, a stamp, and hers.
  repetidor: { impact: [{ id: 'slam' }] },
  empollon: { impact: [{ id: 'hit' }] },
  chivata: { impact: [{ id: 'mark-set' }] },
  gemelo: { impact: [{ id: 'hit', volume: .8 }] },
  delegada: { impact: [{ id: 'hit' }] },
  ausente: { impact: [{ id: 'hit' }] },
  castigado: { impact: [{ id: 'slam' }] },
  monton: { impact: [{ id: 'spit' }] },
  aurelia: { impact: [{ id: 'slam', volume: .9 }] },
  atril: { impact: [] },
  directiva: { impact: [{ id: 'thump' }] },
  reina: { impact: [{ id: 'spit' }, { id: 'slam', volume: .7 }] },
  mano: { impact: [] },
  pompa: { impact: [] },
  // Emilie's model: a spark off a dead cell, a value flickering, water spreading, figures falling.
  'celda-seca': { impact: [{ id: 'zap', volume: .6 }] },
  oscilacion: { start: [{ id: 'glitch', volume: .5 }], impact: [{ id: 'zap', volume: .6 }] },
  atomo: { impact: [{ id: 'splash', volume: .8 }] },
  'no-converge': { start: [{ id: 'glitch', volume: .6 }], impact: [{ id: 'zap' }] },
  polilla: { impact: [{ id: 'hit', volume: .5 }] },
  'estampado-rojo': { impact: [{ id: 'hit', volume: .75 }] },
  'estampado-azul': { impact: [{ id: 'hit', volume: .75 }] },
  'estampado-oro': { impact: [{ id: 'hit', volume: .75 }] },
  capellan: { impact: [{ id: 'hit', volume: .8 }] },
  fran: { impact: [{ id: 'slam', volume: .85 }] },
  lampara: { impact: [{ id: 'hit', volume: .5 }] },
};
const foeOf = (effect: BattleEffect, state?: BattleState) => state?.foes.find(f => f.id === effect.actor);

/** Matemágico's thrown Atacar as the ball leaves the hand (battle-scene): its own for each element. */
export const spellLaunch = (element?: Element): Cue[] => element === 'fuego' ? [{ id: 'fire-cast', volume: .7 }]
  : element === 'agua' ? [{ id: 'cast-soft' }, { id: 'splash', volume: .3 }]
  : element === 'electrico' ? [{ id: 'cast-soft', volume: .7 }, { id: 'zap', volume: .6 }]
  : [{ id: 'cast-soft' }];
/** What sounds as an action begins. */
export function startSounds(effect: BattleEffect, state?: BattleState): Cue[] {
  // Thrown: the circle opens as he works it out; the ball's own sound comes as it leaves.
  if (effect.kind === 'attack' && effect.spell) return [{ id: 'think', volume: .6 }];
  if (effect.kind === 'escape') return [{ id: 'flee' }];
  // A charged dual going off (Rayo solar) sweeps with its fire: the charge already sounded.
  if (effect.kind === 'skill' && effect.release) return [{ id: 'charge', volume: .5 }];
  if (effect.kind === 'skill' && effect.dual) return dualSounds(effect.dual.parts).start ?? [];
  if (effect.kind === 'skill' && effect.skill) return SKILL_SOUNDS[effect.skill].start ?? [];
  const kind = effect.kind === 'enemy' ? foeOf(effect, state)?.kind : undefined;
  return kind ? FOE_SOUNDS[kind].start ?? [] : [];
}
/** What sounds as an action lands. */
export function impactSounds(effect: BattleEffect, state?: BattleState): Cue[] {
  if (effect.kind === 'defend') return [{ id: 'guard' }, ...effect.charged ? [{ id: 'mana' as const, delay: .12 }] : []];
  if (effect.swallowed) return [{ id: 'swallowed' }];
  // Fran's salon: a blow the light ate fizzles out (docs/quests/luca.md).
  if (effect.annulled) return [{ id: 'fizzle' }];
  // A blow that opens a wound (it spent Sangrado) tears as it lands.
  // And a golpe crítico is heard before anything else of the blow (a flurry's later ones, as each claw lands: battle-scene).
  const torn: Cue[] = [...effect.crit && effect.crits?.[0] !== false && !effect.dual ? [{ id: 'crit' as const }] : [], ...effect.bled || effect.hits?.some(h => h.bled) ? [{ id: 'bleed' as const, delay: .04 }] : []];
  // Atacar with an element sounds of it, and what it turned on top.
  if (effect.kind === 'attack') return effect.amount ? [{ id: 'hit' }, ...effect.element ? [ELEMENT_SOUNDS[effect.element]] : [], ...effect.reaction ? REACTION_SOUNDS[effect.reaction.id] : [], ...torn] : [];
  // A dual that rolls claw by claw sounds each claw as it lands, fire or not (battle-scene `dualStrike`): the first says nothing of the rest.
  if (effect.kind === 'skill' && effect.release) return [{ id: 'beam' }, { id: 'fire-hit', delay: .06 }];
  // Charging up only hums: it lands as the next round starts.
  if (effect.kind === 'skill' && effect.charging) return [{ id: 'fire-cast', volume: .6 }, { id: 'mana', delay: .1 }];
  if (effect.kind === 'skill' && effect.dual) return [...effect.coins ? [] : dualSounds(effect.dual.parts).impact, ...torn];
  if (effect.kind === 'skill' && effect.skill) {
    // Fire that does not catch (an onion's wet layers) fizzles; on the palace minion's gum it melts it too.
    if (effect.skill === 'foc-binari') return [...effect.melted ? [{ id: 'melt' as const }] : [], { id: effect.burn || effect.melted ? 'fire-hit' as const : 'fizzle' as const }, ...torn];
    // Atractor extraño: what met in its target and reacted sounds after the note, one after another.
    const met = (effect.gathered ?? []).flatMap(g => g.reactions).flatMap((r, i) => REACTION_SOUNDS[r.id].map(c => ({ ...c, delay: (c.delay ?? 0) + .25 + i * .12 })));
    return [...SKILL_SOUNDS[effect.skill].impact, ...met, ...torn];
  }
  // A mago charging its Bombona: the gas hisses out. El Campeón in plain clothes pulling itself together.
  if (effect.kind === 'enemy' && effect.telegraph?.id === 'bombona') return [{ id: 'fizzle' }];
  if (effect.kind === 'enemy' && effect.healed) return [{ id: 'heal', volume: .6 }];
  // Fran's salon: a chaplain left mid-gesture.
  if (effect.kind === 'enemy' && effect.cancelled && !effect.amount) return [{ id: 'sink', volume: .6 }];
  // The castle's moves that are a word, not a blow (Chivatazo, Dictado announced, La Pompa starting): a mark set, heard.
  if (effect.kind === 'enemy' && !effect.amount && !effect.splash && (effect.telegraph || effect.called?.length) && isCastle(foeOf(effect, state)?.kind)) return [{ id: 'mark-set' }];
  if (effect.kind !== 'enemy' || !(effect.amount || effect.splash)) return [];
  const foe = foeOf(effect, state);
  // Whoever hit everyone: a fantasmita's «GAME OVER» and Vertitrón's (Barrido; the Rayo cracks as it sweeps).
  if (effect.splash && foe?.kind === 'fantasmita') return [{ id: 'game-over' }];
  if (effect.splash && foe?.kind === 'mago') return [{ id: 'fire-hit' }, { id: 'slam', volume: .6, delay: .06 }];
  if (effect.splash && foe?.kind === 'vertigo') return effect.ability?.id === 'rayo' ? [{ id: 'crack' }, { id: 'slam', delay: .08 }] : [{ id: 'slam' }];
  if (state?.allies.find(a => a.id === effect.target)?.guarding) return [{ id: 'hit-guarded' }];
  if (isOnion(foe?.kind) && !foe?.layers) return [{ id: 'hit', volume: .6 }];
  return foe?.kind ? FOE_SOUNDS[foe.kind].impact : [{ id: 'hit' }];
}
