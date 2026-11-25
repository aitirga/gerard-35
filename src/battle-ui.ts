import { clickControllerButton } from './controller-ui';
import { statusSvg, type IconId } from './status-icons';
import { GUIDES, GUIDE_GROUPS, guideIcon, guideState, guideVersion, isGuide, type GuideId, type GuidesSeen } from './status-guide';
import type { ControlAction } from './controller';
import { TONES, VOZ_SONG, turnAt } from './song';
import { ECOS, GRADE_NAMES, ecosOf, ecoMuffled, takeEcoNews, type EcoNews, PASSIVES, COMBUSTION, AFFINITIES, ELEMENT_RULES, POWDER_RULES, cortinaRounds, awakeUlti, ultiProgress, MANA_LEVEL, elementOf, type Affinity, type FoeKind, diceOf, dieUse, faceUse, bestDie, spareDie, shake, shakesLeft, rachaOf, meteorOf, RACHA, DICED, isCuerdas, attackElement, chooseElement, cycleElement, elementsFor, ELEMENTS, improve, manaMax, woundScale, scentOf, SCENT, markLeft, markSpent, kitIn, DUALS, dualTargets, dualSingle, dualPartner, takeTurn, dualOf, dualReady, createEncounter, DISHES, act, actDual, aimed, awaken, BEAT_HP, boostedStats, boostRounds, commit, dualCost, dualOptions, statNames, intentLabel, isOnion, isSobremesa, planMost, NOTES, childParty, cornered, escapeShown, enemyAct, nextRound, queue, queuedDual, roman, runClock, skillsFor, SKILLS, STAGED_MOMENTS, stageMoment, STAT_SHORT, statShifts, STATUSES, songLabel, songNow, switchAnima, VOZ_PARTS, takeNews, takeSongNews, TIMED, validTargets, WEAK_SPOT, weakSpotRounds, wearAnima, wearsAnimas, type ClassId, type DualBlock, type DualId, type DualSpec, type Element as AttackElement, type Encounter, type GuardStrength, type Improved, type PartySlot, type Queued, type SkillId, type StagedMoment, type BattleAction, type BattleEffect, type BattleState, type Combatant, type StatShift, type StatusId, type Timed, type TimedId, SIGNS, reactionIn, FEAR_ENCOUNTERS, FOE_ABILITIES, vozNote, takeLightNews, lightNow, lampLit, shirtLit, LAMPS, lightEats as lightEatsNow, dieSkill, faceAs, heldMoves, ANIMA_NAMES, ANIMA_OWNERS, canWear, free, type DieFace, CRECIDA, stageWater, ORBITAL_BLIND, plateMarks, type PlateMark, IGNITION_GAP, type ElementReaction, type TimedPulse } from './battle';
import { LIGHTS, cancels, lightAt, upcoming, WALKS, walkLength } from './vidrieras';
import { animaOf, CLASSES, grownUp } from './classes';
import { BATTLE_LINES } from './chapter-1';
import { SPEAKERS } from './dialogue';
import { ELEMENT_ICONS } from './ecos';
import { costPips, flashAnima, setVitals, vitalsPlate } from './vitals';
import { FACE_LINES, FACE_NAMES, faceSvg } from './die-faces';
import { DOG_PROFILES } from './encounters';
import { planEnemyTurn } from './battle-ai';
import { BEAT, DUAL_BANNER, DUAL_BANNER_SEEN, DUAL_EASE, DUAL_SLOW, atractorGiven, holdAfter } from './battle-motion';
import { MAX_LEVEL, award, fightXp, levelForXp, levelProgress, participants, reachOf, toNextLevel, topOf, type Growth } from './levels';
import type { Direction } from './movement';
import type { PlayerId } from './party';
import type { SoundId } from './sfx';
import { CASTLE_ENCOUNTERS, MELODY, isCastle, yearOf, type CastleEncounter, type HeldMove, type NightFight } from './castle';
import { artilugioLive, castleChips, castleNote } from './castle-fight';

/** The castle's fights on the kicker and the heading (docs/castle.md, docs/castle-bosses.md). */
const YEAR_WORDS = { 1: 'PRIMERO', 2: 'SEGUNDO', 3: 'TERCERO' } as const;
/**
 * The entrances' name cards (src/throne-arena.ts, src/boss-stages.ts): where, who, one line. The
 * Queen's in her pink; Aurelià's and Dirección's in possession's violet, held by her.
 */
const BOSS_CARDS: Partial<Record<string, { place: string; who: string; sub: string; held?: true }>> = {
  reina: { place: 'El salón del trono', who: 'La Reina <em>Bubbaloo</em>', sub: 'Lo que dejasteis en el patio.' },
  'reina-vuelta': { place: 'El salón del trono', who: 'La Reina <em>Bubbaloo</em>', sub: 'Lo que dejasteis en el patio.' },
  aurelia: { place: 'El gimnasio', who: '<em>Aurelià</em>', sub: 'No levanta la voz. Nunca le ha hecho falta.', held: true },
  direccion: { place: 'Direcció', who: 'Mar, Montse <em>y Pilar</em>', sub: 'El equipo de Dirección. Reunido desde las nueve.', held: true },
};
const CASTLE_KICKERS = Object.fromEntries(CASTLE_ENCOUNTERS.map(id => [id, id === 'aurelia' ? 'AURELIÀ' : id === 'direccion' ? 'EL EQUIPO DE DIRECCIÓN' : id.startsWith('reina') ? 'LA REINA BUBBALOO'
  : `${id.startsWith('delegada') ? 'LA DELEGADA' : 'ALUMNOS DE LA REINA'} · ${YEAR_WORDS[yearOf(id)]}`])) as Record<CastleEncounter, string>;
const CASTLE_TITLES = Object.fromEntries(CASTLE_ENCOUNTERS.map(id => [id, id === 'aurelia' ? 'Nadie sale <em>hasta el timbre.</em>' : id === 'direccion' ? 'Consta <em>en acta.</em>' : id === 'reina' ? 'Lo que <em>queda.</em>' : id === 'reina-vuelta' ? 'Otra vez, <em>con música.</em>'
  : id.startsWith('delegada') ? 'La que <em>manda.</em>' : ['Chicle <em>fresco.</em>', 'Con algo <em>dentro.</em>', 'Chicle <em>rancio.</em>'][yearOf(id) - 1]])) as Record<CastleEncounter, string>;

/**
 * The commands, in order (the number keys follow it). In development the Dual command sits third:
 * every dual attack, whether it can happen now and why not (docs/dev-tools.md). In the game a dual
 * only happens by surprise, from the queue (`commit`), so the command is not there at all.
 */
type Command = BattleAction | 'dual';
const commandsFor = (dev: boolean): { id: Command; name: string }[] => [
  { id: 'attack', name: 'Atacar' },
  { id: 'skill', name: 'Habilidad' },
  ...dev ? [{ id: 'dual' as const, name: 'Dual' }] : [],
  { id: 'defend', name: 'Defender' },
  { id: 'escape', name: 'Huir' },
];
/** Uri's fears (docs/quests/nuria.md): what the fight's heading says. */
const FEAR_KICKERS = { cebollon: 'EL CEBOLLÓN', cebolla: 'LA CEBOLLA', plato: 'EL PLATO MISTERIOSO', escolta: 'LA CEBOLLA Y LOS SUYOS', 'uri-vertigo': 'VERTITRÓN', sobremesa: 'LA SOBREMESA', 'camping-magos': 'MAGOS DE CAMPING', 'camping-dados': 'DADOS', 'camping-agentes': 'AGENTES', 'camping-tienda': 'UNA TIENDA EQUIVOCADA', 'camping-negra': 'LA PARCELA NEGRA', campeon: 'EL CAMPEÓN', 'cuerdas-lealtad': 'LA LEALTAD', 'cuerdas-cristalino': 'LO CRISTALINO', 'cuerdas-directo': 'LO DIRECTO', voz: 'LA VOZ', ...CASTLE_KICKERS, 'modelo-celdas': 'CELDAS SECAS', 'modelo-oscilacion': 'OSCILACIONES', 'modelo-atomo': 'EL ÁTOMO', 'no-converge': 'EL QUE NO CONVERGE', 'luca-recepcion': 'LA RECEPCIÓN', 'luca-sillones': 'LOS SILLONES', 'luca-carta': 'LA CARTA DE COLORES', 'luca-abside': 'EL ÁBSIDE', fran: 'FRAN' } as const;
const FEAR_TITLES = { cebollon: 'Capa sobre <em>capa.</em>', cebolla: 'Pesa, <em>y pica.</em>', plato: '¿Y esto qué <em>lleva?</em>', escolta: 'Nunca viene <em>sola.</em>', 'uri-vertigo': 'Mucho más <em>alto.</em>', 'crias-1': 'Pequeñas, <em>pero pican.</em>', 'crias-2': 'Para <em>picar.</em>', 'crias-3': 'Nivel <em>extra.</em>', sobremesa: 'Nadie se <em>levanta.</em>', 'camping-magos': 'Huele a <em>gas.</em>', 'camping-dados': 'Cada ronda, <em>otra cara.</em>', 'camping-agentes': 'Uno da la <em>cara.</em>', 'camping-tienda': 'Esa no <em>era.</em>', 'camping-negra': 'Todo <em>apagado.</em>', campeon: 'Su plan, <em>en marcha.</em>', 'cuerdas-lealtad': 'No se <em>aparta.</em>', 'cuerdas-cristalino': 'Se ve <em>a través.</em>', 'cuerdas-directo': 'Sin <em>rodeos.</em>', voz: 'Lo que <em>falta.</em>', ...CASTLE_TITLES, 'modelo-celdas': 'Sin <em>valor.</em>', 'modelo-oscilacion': 'Ni uno <em>ni otro.</em>', 'modelo-atomo': 'Todo se <em>transforma.</em>', 'no-converge': 'Nunca se <em>queda.</em>', 'luca-recepcion': 'Van a <em>la luz.</em>', 'luca-sillones': 'Esperen <em>turno.</em>', 'luca-carta': 'Colores <em>robados.</em>', 'luca-abside': 'Mirar <em>arriba.</em>', fran: 'Les <em>toca.</em>' } as const;
/** What a blow says it did to an onion's layers. */
const peelText = (peeled: number, onion?: { layers?: number }) => !onion?.layers ? '¡Sin capas!' : peeled > 1 ? `¡${peeled} capas menos!` : '¡Una capa menos!';
const TARGETS = { foes: 'Un enemigo', 'all-foes': 'Todos los enemigos', allies: 'Un aliado herido', party: 'Todo el equipo' } as const;
/** A fighter's ánima pills, with L and R (Q and E) on either side to walk through them. */
const ANIMA_SWITCH = `<div class="anima-switch" role="group" aria-label="Ánima" hidden><span class="battle-kicker">ÁNIMA</span><button class="anima-key" type="button" tabindex="-1" data-step="-1" aria-label="Ánima anterior"><kbd data-glyph="prev"></kbd></button><div class="anima-chips"></div><button class="anima-key" type="button" tabindex="-1" data-step="1" aria-label="Ánima siguiente"><kbd data-glyph="next"></kbd></button></div>`;
/**
 * A partner's own corner of their dock while the other player chooses (split mode): they can get
 * their move ready ahead (`queue`) with their own device; it plays when their turn comes. Its own
 * cursor, never the page's focus, which stays with whoever's turn it is.
 */
const QUEUE_PARTS = `<section class="queue-panel" aria-label="Preparar tu acción" hidden><span class="battle-kicker"></span><div class="queue-list"></div><p class="queue-hint" data-glyph-template="{confirm} Preparar" hidden></p></section>
      <div class="queue-plate" hidden><span class="battle-kicker">PREPARADO</span><strong></strong><button class="queue-cancel" type="button" tabindex="-1" data-glyph-template="{cancel} Quitar" hidden></button></div>
      <p class="queue-note" hidden>Ya no se puede: elige otra vez.</p>`;
/** The details hint goes once it has been used (AGENTS.md: key hints disappear once used). */
let detailsLearned = false;
/** So does the one on Atacar's block, once an element has been changed. */
let elementLearned = false;
/** So does the summary's (the D-pad's left or right, R on the keyboard). */
let summaryLearned = false;
/** What the player's blows have found each kind of foe to be made of, for as long as the page lives: its plate keeps it. */
const foundAffinities = new Map<FoeKind, Set<AttackElement>>();
/** "1 ronda", "3 rondas". */
const rounds = (n: number) => `${n} ${n === 1 ? 'ronda' : 'rondas'}`;
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** What a light eats, as the party's window says it. */
const lightEats = (state: BattleState, light: keyof typeof LIGHTS) => { const element = lightEatsNow(state, light); return element === 'fisico' ? 'Anula los golpes físicos' : element ? `Anula ${ELEMENTS[element].name.toLowerCase()}` : cancels(light) ? 'Ya no anula nada' : 'No anula nada'; };
const lightText = (state: BattleState, light: keyof typeof LIGHTS) => `Luz ${LIGHTS[light].name.toLowerCase()}: ${lightEats(state, light).toLowerCase()} del equipo.`;
/** What each status a newer dual leaves does, in the few words under its name as it lands. */
/** A reaction's name over the PV it took, when it came on its own (Arco voltaico's charge jumping). */
const REACTION_SAID: Record<string, string> = { plasma: 'Plasma', tormenta: 'Tormenta', conduccion: 'Conducción', estallido: 'Estallido', cauterizado: 'Cauterizado' };
const DUAL_LEFT: Partial<Record<TimedId, string>> = {
  marea: 'El agua sube en todos a la vez', fulgurita: 'Las esquirlas cuentan juntas', metralla: 'La herida no se gasta',
  'idea-fija': 'Golpea a los suyos cada 5 s', seiche: 'Golpea y sostiene el agua', staccato: 'Corta de nuevo cada 5 s',
  gas: 'Su agua, separada',
  alterna: 'Va y viene cada 5 s',
};
/** What an element turned, as it pops over whoever it turned on: the reaction's name, a few words, and the status it looks like. */
function reactionSays(reaction: { id: ElementReaction; level?: number; stacks?: number }) {
  return { humo: { id: 'cegado', text: `¡${TIMED.cegado.name}!`, detail: 'Se apaga el fuego' }, cauterizado: { id: 'cauterizado', text: '¡Cauterizado!', detail: `Sangrado × ${reaction.stacks ?? 0}` }, tormenta: { id: 'tormenta', text: '¡Tormenta!', detail: 'Salta por el humo' }, vapor: { id: 'cegado', text: `¡${TIMED.cegado.name}!`, detail: 'El agua se va en vapor' }, conduccion: { id: 'conduccion', text: '¡Conducción!', detail: 'Corre por el agua' }, plasma: { id: 'plasma', text: '¡Plasma!', detail: `${TIMED.quemado.name} ${roman(reaction.level ?? 1)}, de golpe` }, estallido: { id: 'quemado', text: '¡Estallido!', detail: 'El polvo arde de golpe' }, veneno: { id: 'envenenado', text: `¡${TIMED.envenenado.name}${(reaction.level ?? 1) > 1 ? ` ${roman(reaction.level!)}` : ''}!`, detail: 'El agua corre el polvo' }, cristal: { id: 'cristalizado', text: `¡${TIMED.cristalizado.name}!`, detail: 'El polvo se hace esquirlas' } }[reaction.id];
}
/** A stat up or down in words: «Defensa +4», or «Defensa ▼» for an onion's broken defence, which has no number. */
const shiftText = (shift: StatShift) => `${statNames([shift.stat])} ${shift.amount ? `${shift.way === 'up' ? '+' : '−'}${shift.amount}` : shift.way === 'up' ? '▲' : '▼'}`;
/** The queue's hints go once used: preparing a choice ahead, and taking it back. */
let queueLearned = false, unqueueLearned = false;
/** Duals already seen this session: their banner holds for less (DUAL_BANNER_SEEN), and they count as found (the fight tester's are never kept). */
const seenDuals = new Set<DualId>();
/** Duals that played already seen: the beat after them is shorter too (BEAT.dualSeen). */
const repeatedDuals = new WeakSet<BattleEffect>();
/** What the party has said once this session about a fear's trick (a line in a bubble, never a panel). */
const remarked = new Set<string>();
/**
 * Where the picker can jump a fight in development (`jumpTo`); `won-level` wins with EXP enough for
 * every ánima in it to level up. The rest are moments the fight stages itself (`stageMoment`):
 * Vertitrón's moments and El Plato's surprise, each offered only in its own fight.
 */
/** `agua-N`: every foe standing with N marks of water (La crecida, Freática; 0 dries them), `stageWater`. */
export type FightMoment = 'won' | 'won-level' | 'lost' | 'foes-low' | 'party-low' | 'beat' | 'agua-0' | 'agua-1' | 'agua-2' | 'agua-3' | StagedMoment;

export function createBattleUI(hud: HTMLElement, callbacks: {
  /** `onImpact` runs as each blow lands: 0 at contact, then a flurry's others (`BattleEffect.strikes`). */
  change: (state: BattleState | undefined, effect?: BattleEffect, onImpact?: (blow: number) => void) => Promise<void>;
  /** Whom `player` is aiming at (none: nobody), each player in their own colour (gold Gerard's, cyan Aitor's); `by` is the fighter choosing, who turns towards it. */
  target: (id: string | undefined, player: PlayerId, by?: string) => void;
  /** Dadista: the die of `unit`'s hand the cursor is on while one is being picked (none: nobody is picking). */
  aimDie?: (unit?: string, index?: number) => void;
  /** Dadista shook the hand (Agitar): `unit`'s dice tumble again in the fight. */
  shakeDice?: (unit: string) => void;
  /** A moment only this screen knows of that makes a sound (a burn's pulse, a bleed, changing ánima). */
  sound: (id: SoundId) => void;
  /** An ánima woke up in Gerard mid-fight (the palace minion's beat). */
  awaken: (id: ClassId) => void;
  /** Which player picks this fighter's moves (docs/party.md). Keyboard and mouse are player 1. */
  driver: (allyId: string) => PlayerId;
  /** Whether that player has nothing to play with yet (player 2 without a controller). */
  waiting: (allyId: string) => boolean;
  /** A fighter changed ánima mid-fight (L / R or a pill): keep the choice and show it in the 3D fight. */
  anima: (allyId: string, classId: ClassId) => void;
  /** Development only: one player drives the whole party, Aitor included (docs/party.md). */
  solo: () => boolean;
  /** Whether the fight's clock is stopped (the pause menu is open). */
  paused: () => boolean;
  /** A timed status pulsed on a fighter (Quemado): the 3D fight shows it land. */
  pulse: (id: string, status?: string, by?: string, beat?: TimedPulse) => void;
  /** Whether a fall here can be fought again or stepped back from: everywhere but chapter 2's castle, where it wakes Gerard up at home. */
  forgiving?: () => boolean;
  /** On the lost screen the players chose to fight again or go back to just before the fight: the end that follows is no fall. */
  fallen?: (choice: 'retry' | 'rewind') => void;
  /** Whether the real artilugio is there (src/artilugio.ts): its keys only show while it is not. */
  board?: () => boolean;
  /**
   * The combat guide (src/status-guide.ts): which cards the players have seen, at which version, and
   * one just read. Without it no card stops the fight (scenarios and automated runs).
   */
  guides?: { seen: () => GuidesSeen; mark: (id: GuideId, version: string) => void };
  /** Development build (`import.meta.env.DEV`): the Dual command takes its place in the menu. */
  dev?: () => boolean;
  /** A dual's banner: the 3D fight runs at `scale` for `seconds` of real time, then eases back (the scene's FightClock); 0 stops it. */
  slowmo?: (scale: number, seconds: number) => void;
  /**
   * The action about to play, before anything holds it up (a dual's unlock, a foe's move named): the
   * rules have already changed the fight, and the scene must not show what it did before it plays.
   */
  upcoming?: (effect: BattleEffect) => void;
  /**
   * La Reina Bubbaloo at 0 on her stage (docs/castle-bosses.md § The last scene): the fight does not
   * end on its victory screen. Its HUD goes, this plays the last scene in it (`say` puts a line over a
   * fighter's head), and once it resolves the fight closes.
   */
  lastScene?: (say: (speaker: keyof typeof SPEAKERS, text: string, ms: number) => Promise<void>) => Promise<void>;
  /**
   * Whether the players have found this dual already (`Story.duals`). One not found is never armed
   * while it is aimed: it can only happen by chance, and the first time it does time stops to unlock it.
   */
  known?: (id: DualId) => boolean;
  /** How fast the 3D fight runs now (1: full speed), all its slow motions together: the fight's clock follows it. */
  speed?: () => number;
  /**
   * La Voz's song, every frame of her fight: seconds into it on the fight's clock, and how fast that
   * clock runs now (0 while it is stopped), so her recording plays exactly where the fight is.
   */
  song?: (t: number, rate: number) => void;
  /** Sincopante's ecos did something on their own (a note, going out, a chord): the 3D fight shows it. */
  ecos?: (news: EcoNews[]) => void;
}) {
  const COMMANDS = commandsFor(!!callbacks.dev?.());
  /** The commands, one set in each dock: with two players both choose at once, each in their own. */
  const commandPanel = (n: PlayerId) => `
      <section class="command-panel" aria-label="Acciones de combate">
        <div class="turn-heading"><span class="turn-dot"></span><span class="turn-label"></span><span class="turn-meta">TU TURNO</span></div>
        <div class="command-deck">
          <div class="commands">${COMMANDS.map((c, i) => `<article class="command" data-command="${c.id}">
            <button class="command-trigger" type="button" ${c.id === 'skill' || c.id === 'dual' ? 'aria-expanded="false" aria-controls="skill-flyout-${n}"' : ''}><span class="command-number">0${i + 1}</span><strong>${c.name}</strong>${c.id === 'attack' ? '<small class="attack-element-name"></small>' : ''}${c.id === 'skill' || c.id === 'dual' ? '<span class="command-arrow" aria-hidden="true">›</span>' : ''}</button>${c.id === 'attack' ? '<div class="attack-elements" role="group" aria-label="Elemento de Atacar" hidden></div>' : ''}
          </article>`).join('')}</div>
          <section class="skill-flyout" id="skill-flyout-${n}" aria-label="Habilidades" inert><div class="skill-sheet">
            <span class="battle-kicker"></span>
            <span class="skill-more" data-more="up" aria-hidden="true"></span>
            <div class="skill-window"><div class="skill-list"></div><div class="skill-rail" aria-hidden="true" hidden></div></div>
            <span class="skill-more" data-more="down" aria-hidden="true"></span>
            <footer><button class="command-back" type="button">Volver <span data-glyph="cancel"></span></button><p class="flyout-hint"><kbd data-glyph="details"></kbd> Detalles</p></footer>
          </div></section>
        </div>
        <div class="target-picker" hidden><span class="battle-kicker">ELIGE UN OBJETIVO</span><h2></h2><p></p><strong class="target-name" aria-live="polite" hidden></strong><button class="target-back" type="button">Volver <span data-glyph="cancel"></span></button></div>
        <p class="command-help"></p>
      </section>`;
  const root = document.createElement('section');
  root.id = 'battle'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Combate por turnos');
  root.innerHTML = `
    <div class="boss-intro" aria-hidden="true"><i class="boss-bar"></i><i class="boss-bar"></i><p class="boss-name"><small class="boss-place"></small><span class="boss-who"></span><small class="boss-sub"></small></p><p class="boss-skip" data-glyph-template="{confirm} Saltar"></p></div>
    <div class="dual-cinema" aria-hidden="true" hidden><span class="dual-veil"></span><i></i><b></b></div>
    <header class="battle-heading"><span class="battle-kicker">ENCUENTRO / PASSATGE MARESME</span><h1>Un pequeño <em>contratiempo.</em></h1><p class="battle-notes" data-glyph-template="{notes} · El artilugio" hidden></p></header>
    <div class="round-badge"><span>RONDA</span><strong>01</strong></div>
    <button class="summary-key" type="button" tabindex="-1" aria-controls="battle-summary" hidden><kbd data-glyph="summary"></kbd> Resumen</button>
    <section class="battle-summary" id="battle-summary" aria-label="Resumen del combate" hidden></section>
    <div class="battle-targets" aria-label="Objetivos en la calle"></div>
    <aside class="held-side" aria-label="Del lado de la Reina" hidden><p class="held-kicker">DEL LADO DE LA REINA</p><div class="held-card"></div></aside>
    <div class="battle-pops" aria-hidden="true"></div>
    <div class="battle-speech" aria-live="assertive"></div>
    <section class="class-banner" hidden><span class="battle-kicker">ÁNIMA DESBLOQUEADA</span><h2></h2><p></p></section>
    <section class="move-callout" aria-live="polite" hidden><span class="battle-kicker"></span><strong></strong><small></small></section>
    <section class="dual-banner" aria-live="polite" hidden><header><span class="battle-kicker">ATAQUE DUAL</span><h2></h2></header><div class="dual-halves"></div><footer><strong class="dual-total"></strong><p></p></footer></section>
    <section class="skill-reveal" aria-live="polite" hidden><i class="skill-reveal-rays" aria-hidden="true"></i><div class="skill-reveal-card"><span class="battle-kicker"></span><small class="skill-reveal-who"></small><div class="skill-reveal-skills"></div></div></section>
    <button type="button" class="battle-hold" data-glyph-template="{confirm} Continuar" hidden></button>
    <p class="dev-badge" hidden>DEPURACIÓN · UN JUGADOR LLEVA A LOS DOS</p>
    <div class="battle-bottom">
      <section class="battle-dock" data-dock="1">
      <div class="dock-plate"></div>
      ${ANIMA_SWITCH}
      <p class="dock-wait" hidden></p>
      ${QUEUE_PARTS}
      ${commandPanel(1)}
      </section>
      <section class="battle-dock" data-dock="2" data-glyph-player="2" hidden>
      <div class="dock-plate"></div>
      ${ANIMA_SWITCH}
      <p class="dock-wait" hidden></p>
      ${QUEUE_PARTS}
      ${commandPanel(2)}
      </section>
      <div class="party-roster" aria-label="Tu equipo"></div>
    </div>
    <section class="guide-card" role="dialog" aria-modal="true" aria-labelledby="guide-title" hidden><div class="guide-card-box"><span class="guide-card-icon" aria-hidden="true"></span><span class="battle-kicker"></span><h2 id="guide-title"></h2><small class="guide-card-who"></small><p></p><button type="button" class="guide-card-ok" data-glyph-template="{confirm} Entendido"></button></div></section>
    <aside class="skill-info" role="tooltip" id="skill-info" hidden><h3></h3><p></p><strong class="skill-info-cost"></strong></aside>
    <section class="battle-result" hidden><span class="battle-kicker">FIN DEL ENCUENTRO</span><h2></h2><p></p>
      <div class="result-xp" hidden><span class="battle-kicker">EXPERIENCIA</span><strong></strong></div>
      <ul class="result-animas" aria-label="Ánimas que han luchado" hidden></ul>
      <button type="button" data-after="close">Volver a la calle</button>
      <button type="button" data-after="retry" hidden>Reintentar el combate</button>
      <button type="button" data-after="rewind" hidden>Volver a antes del combate</button></section>`;
  hud.append(root);
  /**
   * Whose menu the code is working on now (`withPlayer`): with two players each has their own
   * commands, choices and cursor, in their own dock. `get` looks in that dock first, then the screen.
   */
  let ctx: PlayerId = 1;
  const scope = () => root.querySelector<HTMLElement>(`.battle-dock[data-dock="${state && split() ? ctx : 1}"]`)!;
  const get = <T extends HTMLElement>(selector: string) => (scope().querySelector<T>(selector) ?? root.querySelector<T>(selector))!;
  /** At most this many skills in sight on the sheet, which never rises above `SHEET_TOP` px from the top of the screen. */
  const SKILL_ROWS = 4, SHEET_TOP = 96;
  let state: BattleState | undefined;
  let selected: Command | undefined;
  let selectedSkill: SkillId | undefined;
  /** Dadista: the skill whose die is being picked on the sheet, and the die picked (its place in the hand). */
  let pickingDie: SkillId | undefined;
  let selectedDie: number | undefined;
  /** Development: the dual the Dual command is aiming. */
  let selectedDual: DualId | undefined;
  let targeting = false;
  /** The details window beside the focused skill (△ / Y on a controller, I on the keyboard). */
  let details = false;
  let busy = false;
  let generation = 0;
  /**
   * The rules settle an action the moment it is chosen; the screen shows it as it lands (`holdBack`).
   * PV it has changed but not landed yet, per fighter: a flurry's bar drops one blow at a time.
   */
  const owed = new Map<string, number>();
  /** The PV someone's bar shows right now: what they have, plus what is still on its way. */
  const shownHp = (c: Combatant) => Math.min(c.maxHp, c.hp + (owed.get(c.id) ?? 0));
  /**
   * A fire settled but not landed, per fighter: how it was before, and the level each of its blows
   * brings if it rolls them one by one (Zarpazos de fuego), of which `landed` have landed.
   */
  const heldFire = new Map<string, { before?: Timed; burns?: readonly number[]; landed: number }>();
  /** The fire someone shows right now. */
  function shownFire(c: Combatant): Timed | undefined {
    const held = heldFire.get(c.id);
    if (!held) return c.timed?.quemado;
    const was = held.before?.level ?? 0, level = Math.max(was, ...held.burns?.slice(0, held.landed) ?? []);
    return level > was ? { level, left: TIMED.quemado.seconds, next: TIMED.quemado.every } : held.before;
  }
  // Water held under a foe (La crecida) is its own Mojado: the plate shows the water, not the two.
  const shownTimed = (c: Combatant) => ({ ...c.timed, quemado: shownFire(c), ...c.timed?.agua ? { mojado: undefined } : {} });
  /** An action chosen whose first blow has not landed: nobody's statuses change on screen until it does. */
  let unlanded = false;
  /** While it has not landed, whose statuses show as they are now all the same (Atractor extraño's sources, once theirs have risen off them). */
  const released = new Set<string>();
  /** Runs `action`, and what it changes on the fighters waits to show until it lands (`present`). */
  function holdBack<T extends BattleEffect | undefined>(action: () => T): T {
    const before = snapshot();
    const effect = action();
    if (effect) holdFrom(before, effect);
    return effect;
  }
  /** Everyone's PV and fire now, to hold what changes from here (`holdFrom`). */
  const snapshot = () => [...state!.allies, ...state!.foes].map(c => ({ c, hp: c.hp, fire: c.timed?.quemado, copy: c.timed?.quemado && { ...c.timed.quemado } }));
  function holdFrom(before: ReturnType<typeof snapshot>, effect: BattleEffect) {
    unlanded = true;
    for (const { c, hp, fire, copy } of before) {
      if (c.hp !== hp) owed.set(c.id, hp - c.hp);
      if (c.timed?.quemado !== fire) heldFire.set(c.id, { before: copy, burns: effect.target === c.id ? effect.burns : undefined, landed: 0 });
    }
  }
  let previousFocus: HTMLElement | null = null;
  /** Each ánima's EXP when the fight started (src/levels.ts): where the victory screen's bars start. */
  let xpBefore: Partial<Record<ClassId, number>> = {};
  /** The level the castle lets a shared ánima reach (src/castle.ts `levelCap`); none in the fight tester. */
  let levelCap: number | undefined;
  /** The victory screen's ánimas are shown once per fight. */
  let rewarded = false;
  /** The Queen's last scene has started in this fight (`lastScene`): no victory screen, and no key or button reaches the fight. */
  let finale = false;
  let rewardFrame = 0;
  const outside = () => [...hud.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== root);
  const articles = () => [...scope().querySelectorAll<HTMLElement>('.command')];
  function focusFirst() { focusOn(get<HTMLButtonElement>('.command-trigger')); }
  const panelEl = () => get('.command-panel');
  const skillButtons = () => [...scope().querySelectorAll<HTMLButtonElement>('.skill-list [data-skill], .skill-list [data-dual], .skill-list [data-die]')];
  /** Why a command can't be used now, if it can't. Bernat has no skills: he only attacks. */
  function blocked(command: Command) {
    if (!state || locked() || state.phase !== 'player' || callbacks.waiting(state.allies[state.active].id)) return true;
    if (command === 'dual') return !wearsAnimas(state.allies[state.active]) || state.allies.length < 2;
    if (command === 'escape') return cornered(state);
    if (command === 'skill') return !skillsFor(state, state.allies[state.active]).length;
    return false;
  }
  // The dark trail lags behind the fill, so each hit shows how much it took.
  function fill(bar: Element, ratio: number) { bar.querySelectorAll<HTMLElement>('b, i').forEach(el => { el.style.width = `${ratio * 100}%`; }); }
  const positions = new Map<string, { x: number; y: number }>();
  /** Each fighter's plate over the fight and where `positionTargets` last put it. */
  const plates = new Map<string, HTMLElement>(), plateAt = new WeakMap<HTMLElement, string>();
  /** A number or a word flying off a fighter. A `status` one (its id in `status`) is stamped on in its colour, above where the blow's numbers rise. */
  function pop(id: string, text: string, kind: 'damage' | 'crit' | 'heal' | 'guard' | 'stat-up' | 'stat-down' | 'status' | 'passive' | 'lives', detail = '', status?: string, dx = 0, dy = 0) {
    const at = positions.get(id);
    if (!at) return;
    const el = document.createElement('span');
    el.className = 'damage-pop'; el.dataset.kind = kind;
    if (status) el.dataset.status = status;
    el.innerHTML = `<strong></strong>${detail ? '<small></small>' : ''}`;
    el.querySelector('strong')!.textContent = text;
    if (detail) el.querySelector('small')!.textContent = detail;
    // A passive's plate sits higher still, and stays a little longer: it is the ánima speaking, not the blow.
    el.style.transform = `translate(${at.x + dx + (kind === 'passive' ? 0 : (Math.random() - .5) * (kind === 'status' || kind === 'crit' || kind === 'lives' ? 8 : 26))}px, ${at.y - dy - (kind === 'passive' ? 150 : kind === 'status' ? 96 : 18)}px) translate(-50%, -100%)`;
    get('.battle-pops').append(el);
    setTimeout(() => el.remove(), kind === 'passive' || kind === 'lives' ? 1900 : kind === 'crit' ? 1600 : kind === 'status' ? 1350 : 1100);
    return el;
  }
  /**
   * Siete vidas going off (docs/animas/papagato/README.md § Definitiva): the number of the blow that was
   * coming lands red and large, the fight holds on it, and it turns over into the cure it became, green,
   * with the definitiva's name under it. Once for each time it goes off, whatever shows it first.
   */
  const livesShown = new WeakSet<object>();
  /** Cegado: a blinded foe's physical blow went past whoever it was meant for. Smoke grey, over them, where its number would be. */
  const missPop = (id: string, dx = 0) => pop(id, 'Falla', 'status', 'No ve nada', 'cegado', dx)?.setAttribute('data-miss', '');
  function livesPop(id: string, saved: { blow: number; amount: number }) {
    if (livesShown.has(saved)) return;
    livesShown.add(saved);
    const el = pop(id, `−${saved.blow}`, 'lives', '¡Siete vidas!');
    if (!el) return;
    callbacks.sound('crit');
    const token = generation;
    setTimeout(() => { if (token !== generation) return; el.querySelector('strong')!.textContent = `+${saved.amount}`; el.dataset.turned = ''; callbacks.sound('heal'); }, 380);
  }
  const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
  /** What a fire landing says over its target: its level, or Combustión at IV, with its own icon. */
  const fireSays = (target: string, id: TimedId, level: number) => id === 'quemado' && level >= COMBUSTION.level
    ? { target, id: 'combustion', text: '¡Combustión!', detail: 'Un golpe físico la hace estallar' }
    : { target, id: id as string, text: `¡${TIMED[id].name}${level > 1 ? ` ${roman(level)}` : ''}!`, detail: level > 1 ? 'El fuego sube' : '' };
  /** A definitiva's progress as its corner says it: a bomb's power as a share of its top, the rest as counts. */
  const ultiMark = (p: { skill: SkillId; have: number; need: number }) => p.skill === 'enjambre' ? `${Math.round(100 * p.have / p.need)}%` : `${p.have}/${p.need}`;
  /** A definitiva woke: said over whoever wears it, and its command is in their list from now on. */
  function ultiAwoke(id: SkillId) {
    const skill = SKILLS.find(sk => sk.id === id)!, wearer = state?.allies.find(a => a.hp > 0 && a.classId === skill.class);
    if (!wearer) return;
    pop(wearer.id, skill.name, 'passive', 'Definitiva · despierta')?.style.setProperty('--anima', CLASSES[skill.class].colour);
    callbacks.sound('mark-set');
  }
  /**
   * The statuses on someone, in the order the plate and the summary show them: stacks or level, and how long they last.
   * Which icons, and in what order, is `plateMarks` (src/battle.ts), the list Serie de Fourier counts: only the words are here.
   */
  type StatusEntry = { id: IconId; name: string; mark: string; timed: boolean; lasts: string; guide?: GuideId };
  function statusList(c: Combatant): StatusEntry[] {
    const shown = shownTimed(c);
    return plateMarks(state, c, { timed: shown, hp: shownHp(c) }).map(mark => statusEntry(c, mark, shown));
  }
  function statusEntry(c: Combatant, mark: PlateMark, shown: ReturnType<typeof shownTimed>): StatusEntry {
    switch (mark) {
      // An Encarnado, as long as it stands: what it is and what beating it leaves.
      case 'encarnado': return { id: 'encarnado', name: 'Encarnado: más entero y pega más. Vencido, suelta un Eco de luz.', mark: '', timed: false, lasts: 'todo el combate' };
      // Fran's salon: the light on now, on each of the party's plates (it only touches them).
      case 'luz': return { id: 'luz', name: lightText(state!, lightNow(state!)!), mark: '', timed: true, lasts: upcoming(state!.light!.t, 2, state!.light!.walk).map(id => LIGHTS[id].name).join(', ') };
      // La Voz angered by blows that went through her while she sang: whom her next note goes at, and how hard.
      case 'enfado': return { id: 'enfado', name: `Enfado: su siguiente nota va a por ${state!.allies.find(a => a.id === c.enfado!.at)?.name ?? 'quien la enfadó'} y pega más`, mark: c.enfado!.level > 1 ? String(c.enfado!.level) : '', timed: false, lasts: 'su siguiente nota' };
      // La Voz's song, a status that never runs out: its ring is the phrase, its hand where the song is, its corner her Crescendo.
      case 'cancion': return { id: 'cancion', name: `Canción: ${songLabel(state!)}. Solo recibe daño en sus silencios.`, mark: c.crescendo ? String(c.crescendo) : '', timed: true, lasts: VOZ_PARTS[state!.song!.part] };
      // El que no converge, converged: it takes every blow whole for the turns in its corner.
      case 'converge': return { id: 'converge', name: 'Converge: recibe el golpe entero', mark: String(c.converged), timed: false, lasts: `${c.converged} ${c.converged === 1 ? 'turno' : 'turnos'}` };
      // El Átomo: its turns to its Reacción, in the corner; at 1 its next turn throws every electron it has at once.
      case 'reaccion': { const n = reactionIn(c); return { id: 'reaccion', name: n === 1 ? 'Reacción: en su siguiente turno, todos sus electrones a la vez' : `Reacción en ${n} turnos`, mark: String(n), timed: false, lasts: `${n} ${n === 1 ? 'turno' : 'turnos'}` }; }
      case 'shock': return { id: 'shock', name: 'Shock: pierde su siguiente turno', mark: '', timed: false, lasts: 'su siguiente turno' };
      // ∂Q/∂t Condensador: the charge he carries, until his next electric blow or a foe's on him.
      case 'cargado': return c.capacitor
        ? { id: 'cargado', name: 'Cargado: su siguiente golpe eléctrico hace el doble; si le golpean antes, salta al que le golpee', mark: '×2', timed: false, lasts: 'su siguiente golpe eléctrico' }
        // Arco voltaico waiting charged: the condenser's charge on whoever waits, until it lands or a foe's blow finds them first.
        : { id: 'cargado', name: 'Cargado: si le golpean antes de saltar, la carga salta al que le golpee y el golpe sale a la mitad', mark: '', timed: false, lasts: 'hasta que salte' };
      // Superficie mínima: the soap film round them until the round ends.
      case 'pelicula': return { id: 'pelicula', name: 'Película de jabón: protegido hasta el final de la ronda; quien le golpee queda mojado', mark: '', timed: false, lasts: 'hasta el final de la ronda' };
      // Dadista's Racha: the dice spent since it was put on, and what they are worth now.
      case 'racha': return { id: 'racha', name: `Racha ${rachaOf(c)}: Crítico +${rachaOf(c) * RACHA.crit} %`, mark: String(rachaOf(c)), timed: false, lasts: 'hasta cambiar de ánima o caer' };
      case 'meteoro': return { id: 'meteoro', name: `${meteorOf(c) === 1 ? 'Meteoro' : 'Asteroide'}: el meteoro ha crecido`, mark: '', timed: false, lasts: 'solo si lo usa en su siguiente turno' };
      case 'sutura': return { id: 'sanacion', guide: 'sutura', name: 'Sutura de luz', mark: '½', timed: false, lasts: 'el siguiente daño esta ronda' };
      // A cortina of powder in front of them, and the definitiva awake on whoever wears its ánima (Fin de fiesta, Siete vidas).
      case 'cortina': return { id: 'cortina', name: 'Cortina de polvo: el siguiente golpe, a la mitad', mark: '½', timed: false, lasts: `el siguiente golpe, o ${rounds(cortinaRounds(state!, c))}` };
      case 'definitiva': return { id: 'definitiva', name: `${awakeUlti(state!, c)!.name}: despierta`, mark: '', timed: false, lasts: 'una vez en este combate' };
      // …and asleep: bought, on whoever wears its ánima, with how near it is to waking (`ultiProgress`).
      case 'dormida': { const asleep = ultiProgress(state!, c)!; return { id: 'dormida', name: asleep.used ? `${asleep.name}: usada en este combate` : `${asleep.name}: dormida (${ultiMark(asleep)})`, mark: asleep.used ? '' : ultiMark(asleep), timed: false, lasts: asleep.used ? 'hasta el siguiente combate' : 'hasta que despierte' }; }
      // Sincopante's ecos, on whoever called them: one continuous icon, Compás, its hand going round once a beat.
      case 'compas': return compasStatus(c);
      // Acecho: their cat crouched, to spring as the next round starts.
      case 'acecho': return { id: 'acecho', name: `${c.stalk!.dual ? DUALS.find(d => d.id === c.stalk!.dual)?.name ?? 'Acecho' : 'Acecho'}: salta sobre ${state?.foes.find(f => f.id === c.stalk!.target)?.name ?? 'su presa'} al empezar la ronda${c.stalk!.dual && !c.stalk!.charged ? ', sin su carga' : ''}`, mark: '', timed: false, lasts: 'hasta que empiece la ronda' };
      // Siete vidas: Yuki's ward, on everyone it covers, until the blow that would have killed one of them.
      case 'siete-vidas': return { id: 'siete-vidas', name: 'Siete vidas: el próximo golpe que fuera a tumbar a alguien del equipo lo cura', mark: '', timed: false, lasts: 'hasta ese golpe' };
      case 'bits': return { id: 'bits', name: `Escudo de bits: ${c.bits!.hp} PV, para cada golpe entero`, mark: String(c.bits!.hp), timed: false, lasts: rounds(Math.max(1, c.bits!.until - (state?.round ?? 0) + 1)) };
      case 'mecha': return { id: 'quemado', guide: 'mecha', name: 'Mecha encendida', mark: '!', timed: false, lasts: 'hasta actuar o caer' };
      case 'punto-debil': return { id: 'punto-debil', name: 'Punto débil: el siguiente golpe hace el triple', mark: `×${WEAK_SPOT}`, timed: false, lasts: rounds(weakSpotRounds(state!, c)) };
      // Fire at its fourth level is Combustión: its own icon and name (a physical blow sets it off).
      case 'combustion': { const on = shown.quemado!; return { id: 'combustion', name: 'Combustión: un golpe físico la hace estallar', mark: roman(on.level), timed: true, lasts: `${Math.ceil(on.left)} s` }; }
    }
    // Past the cases above only a status or a timed one is left: a new mark of the plate without its words above is caught
    // here by the compiler (it is not one of these), not by a crash below.
    const rest: StatusId | TimedId = mark;
    if (rest in STATUSES) { const id = rest as StatusId, n = c.statuses![id]!; return { id, name: `${STATUSES[id].name} ${n}`, mark: String(n), timed: false, lasts: rounds(Math.ceil(n / STATUSES[id].decay)) }; }
    const id = rest as TimedId, on = shown[id];
    if (!on) throw new Error(`Sin estado en la placa para ${id}`);
    // La crecida: Hundido has no level; Congelado says how cracked its ice is, out of the blows it holds.
    if (id === 'hundido') return { id, name: `${TIMED[id].name}: pierde un ${Math.round(TIMED.hundido.share * 100)} % de su vida cada ${TIMED.hundido.every} s`, mark: '', timed: false, lasts: 'mientras su agua esté en la tercera marca' };
    if (id === 'congelado') return { id, name: `${TIMED[id].name} ${roman(on.level)}: no actúa y recibe poco daño${c.cracks ? ` · ${c.cracks} de ${CRECIDA.blows} golpes` : ''}`, mark: roman(on.level), timed: true, lasts: `${Math.ceil(on.left)} s` };
    // Alterna has no level either: the circuit it is a pole of, and its clock.
    if (id === 'alterna') return { id, name: `${TIMED[id].name}: la corriente va y viene cada ${TIMED.alterna.every} s`, mark: '', timed: true, lasts: `${Math.ceil(on.left)} s` };
    // Cegado has no level: what it does, and its clock.
    if (id === 'cegado') return { id, name: `${TIMED[id].name}: sus golpes físicos suelen fallar`, mark: '', timed: true, lasts: `${Math.ceil(on.left)} s` };
    return { id, name: `${TIMED[id].name} ${roman(on.level)}`, mark: roman(on.level), timed: true, lasts: `${Math.ceil(on.left)} s` };
  }
  /** Compás: how many ecos `c` has up, at what grade, and the longest time one has left. */
  function compasStatus(c: Combatant) {
    const mine = ecosOf(state!, c), muffled = mine.some(e => ecoMuffled(state!, e));
    const grades = mine.map(e => GRADE_NAMES[e.grade]).join(' · ');
    return { id: 'compas' as const, name: `Compás: ${mine.length === 1 ? 'un eco' : `${mine.length} ecos`} (${grades})${muffled ? ', apagados' : ''}${c.pedal ? '. Pedal: su tiempo no corre' : ''}`, mark: String(mine.length), timed: true, lasts: `${Math.ceil(Math.max(...mine.map(e => e.left)))} s` };
  }
  /** The fears' own rules, where the player can read them (docs/quests/nuria.md). */
  function ruleChips(c: Combatant, summary = false): [string, string][] {
    const chips: [string, string][] = [];
    // What a blow has already found this kind of foe to be made of (docs/combat.md § Debilidades): never shown before it is found.
    if (c.hp > 0 && c.kind) for (const element of foundAffinities.get(c.kind) ?? []) {
      const a = AFFINITIES[c.kind]?.[element];
      if (a) chips.push([`${a === 'weak' ? 'debil' : 'resiste'}-${element}`, `${a === 'weak' ? 'Débil' : 'Resiste'}: ${ELEMENTS[element].name}`]);
    }
    if (c.hp > 0 && c.layers) chips.push(['capas', `Capas ${c.layers}`]);
    if (c.hp > 0 && c.dish) chips.push(['plato', DISHES[c.dish].name.replace(/^una /, '')]);
    if (c.hp <= 0) return chips;
    // A fantasmita goes off at everyone at 0; on its last count blows go through it.
    if (c.countdown !== undefined) chips.push(['reinicio', `Game over en ${c.countdown}`]);
    if (c.transparent) chips.push(['transparente', 'Transparente']);
    // The campsite's rules on the plate (docs/quests/universidad.md): a dado's face, an agente's side, El Campeón's Plan and his Etapa II.
    if (c.face !== undefined) chips.push(['cara', `Cara ${c.face}`]);
    if (c.faceUp !== undefined) chips.push(c.faceUp ? ['boca-arriba', 'Boca arriba'] : ['boca-abajo', 'Boca abajo']);
    if (c.kind === 'campeon') { chips.push(['plan', `Plan ${c.plan ?? 0}/${planMost(c)}`]); if (c.stage2) chips.push(['etapa', 'Etapa II']); }
    // Las cuerdas' rules (docs/quests/marta.md): glass sends magic back; La Voz's note or her silence, her Crescendo, her Guardia.
    // Cracked, the glass sends nothing back; Lo Directo with its lance in the floor takes more; La Voz out of air after her Calderón broke.
    if (c.kind === 'cristalino') chips.push(c.cracked ? ['rajado', 'Rajado'] : ['cristal', 'Cristal']);
    if (c.stuck) chips.push(['clavado', 'Clavado']);
    // Fran's salon (docs/quests/luca.md): the chaplain the others copy, and the party lacquered (fire hurts them double).
    if (c.peinado) chips.push(['peinado', 'Recién peinado']);
    if (c.kind === 'fran' && c.brillo) chips.push(['brillo', `Brillo ${c.brillo}`]);
    if (c.kind === 'lampara' && state) chips.push(lampLit(state, c) ? ['en-su-luz', 'En su luz'] : ['apagada', 'Fuera de su luz']);
    // La carta de colores: a shirt of Luca's, in the light of its own colour or out of it (only then can it be hurt).
    if (c.kind?.startsWith('estampado') && c.hp > 0 && state?.light) chips.push(shirtLit(state, c) ? ['en-su-luz', 'En su luz'] : ['apagada', 'Fuera de su luz']);
    if (c.kind === 'voz' && state?.song) {
      // Whom her notes go to: whoever touched her last.
      const sung = state.allies.find(a => a.id === c.facing && a.hp > 0);
      if (sung) chips.push(['canta', `Canta → ${sung.name}`]);
      if (c.winded) chips.push(['sin-aire', 'Sin aire']);
    }
    // The castle's rules (src/castle-fight.ts): what a pupil learned, the lectern, the Acta, the Queen's gum and Aitor's marks.
    if (state && c.castle) chips.push(...castleChips(state, c));
    // The model's rules (docs/quests/emilie.md), only in the summary: over the fight its figures say them
    // (a cell grey or lit, the value's colour, the marks of Error over the boss's head). Converged is an icon.
    if (summary && !c.converged && c.sign) chips.push([`valor-${c.sign}`, `Valor: ${SIGNS[c.sign]}`]);
    if (summary && c.kind === 'no-converge' && !c.converged) chips.push(['error', `Error ${c.error ?? 0}`]);
    // A move announced a turn ahead, and at whom (Carrerilla → Aitor), or what is about to happen.
    // One chip for any announced move, as `intentLabel` says it («Rayo terrorífico → todos»).
    const announced = state && c.intent ? intentLabel(state, c) : undefined;
    if (announced) chips.push([c.intent!.ability === 'aplaston' ? 'carrerilla' : c.intent!.ability === 'capa-nueva' ? 'pelada' : c.intent!.ability, announced]);
    return chips;
  }
  /** Stats up or down, over someone's head: one quiet chip each way, the stats in three letters («▲ FUE MAG»). */
  function shiftChips(c: Combatant) {
    const shifts = state ? statShifts(state, c) : [];
    return (['up', 'down'] as const).flatMap(way => {
      const list = shifts.filter(shift => shift.way === way);
      return list.length ? [{ way, text: `${way === 'up' ? '▲' : '▼'} ${list.map(shift => STAT_SHORT[shift.stat]).join(' ')}`, title: list.map(shiftText).join(' · ') }] : [];
    });
  }
  /**
   * What a fighter carries, on their nameplate: first the statuses, as icons with their stacks or
   * level in a corner (a timed one carries a clock, `drain`), and the fears' rules beside them;
   * then, quieter and apart under the bars, the stats they have up or down (their motes in the 3D fight).
   */
  function showStatuses(plate: Element, c: Combatant) {
    const part = (name: string) => {
      let el = plate.querySelector<HTMLElement>(`.${name}`);
      if (!el) { el = document.createElement('span'); el.className = name; plate.append(el); }
      return el;
    };
    const list = part('unit-statuses'), moved = part('unit-shifts');
    const icons = statusList(c), chips = ruleChips(c), shifts = shiftChips(c);
    noteGuides(c, icons, chips, shifts);
    const signature = [...icons.map(i => `${i.id}${i.mark}`), ...chips.map(([id, text]) => `${id}${text}`), '|', ...shifts.map(shift => shift.title)].join(',');
    if (list.dataset.for !== signature) {
      list.dataset.for = signature;
      // Several at once sit closer and a little smaller, so they still fit over one head.
      list.toggleAttribute('data-many', icons.length + chips.length > 2);
      list.replaceChildren(...icons.map(icon => {
        const el = document.createElement('i'); el.className = 'status-icon'; el.dataset.status = icon.id; el.title = icon.name;
        // Olor a sangre: a wound of five or more is a sure golpe crítico for whoever spends it, and its chip says so by burning brighter.
        el.toggleAttribute('data-ripe', icon.id === 'sangrado' && Number(icon.mark) >= SCENT.sure && !!state && !!scentOf(state));
        el.toggleAttribute('data-timed', icon.timed);
        el.innerHTML = `${statusSvg(icon.id)}<b></b>`;
        el.querySelector('b')!.textContent = icon.mark;
        return el;
      }), ...chips.map(([id, text]) => {
        const chip = document.createElement('i'); chip.dataset.status = id;
        chip.textContent = text;
        return chip;
      }));
      moved.replaceChildren(...shifts.map(shift => {
        const chip = document.createElement('i'); chip.dataset.way = shift.way; chip.title = shift.title;
        chip.textContent = shift.text;
        return chip;
      }));
    }
    drain(plate, c);
  }
  /**
   * The combat guide (src/status-guide.ts): what each fighter's plate shows now that has a card,
   * noted as the plates are drawn, with who carries it for the card to name.
   */
  const onPlates = new Map<string, { guides: GuideId[]; who: string }>();
  function noteGuides(c: Combatant, icons: ReturnType<typeof statusList>, chips: [string, string][], shifts: { way: 'up' | 'down' }[]) {
    const ids: string[] = [
      ...icons.map(icon => icon.guide ?? icon.id),
      ...chips.map(([id]) => id.startsWith('debil-') ? 'debil' : id.startsWith('resiste-') ? 'resiste' : ''),
      ...state && c.intent && intentLabel(state, c) ? ['anuncio'] : [],
      ...shifts.map(shift => shift.way === 'up' ? 'sube' : 'baja'),
    ];
    onPlates.set(c.id, { guides: [...new Set(ids.filter(isGuide))], who: c.name });
  }
  /**
   * Something the party has just found or learned (a dual, an ánima, a level's skill) holds the
   * screen until either player confirms (A, Enter, Space or a click), never on a timer; a press
   * before HOLD_MIN is not heard, so one already on its way does not skip it.
   */
  const HOLD_MIN = 700;
  let holdOn: { done: () => void; at: number; focus: HTMLElement | null } | undefined;
  function holdUntilConfirm(): Promise<void> {
    holdOn?.done();
    const button = root.querySelector<HTMLButtonElement>('.battle-hold')!;
    return new Promise(resolve => {
      const focus = document.activeElement as HTMLElement | null;
      holdOn = { at: performance.now() + HOLD_MIN, focus, done: () => {
        holdOn = undefined; button.hidden = true; delete root.dataset.hold;
        if (focus?.isConnected && !focus.closest('[hidden]') && document.activeElement === button) focus.focus({ preventScroll: true });
        resolve();
      } };
      root.dataset.hold = 'true'; button.hidden = false; button.focus({ preventScroll: true });
    });
  }
  function releaseHold() {
    if (!holdOn || performance.now() < holdOn.at) return;
    callbacks.sound('ui-back');
    holdOn.done();
  }
  /** The card on screen: which, and what had the focus before it. */
  let guideOpen: { id: GuideId; focus: HTMLElement | null } | undefined;
  /** A card waits for a quiet moment: nothing playing, nobody being named, the fight not over. */
  function guideReady() {
    return !!state && !!callbacks.guides && !guideOpen && !holdOn && !busy && !finale && !heldChoice && !['won', 'lost', 'escaped'].includes(state.phase)
      && !root.dataset.entering && !root.dataset.beat && !root.dataset.announcing && !root.dataset.revealing && !callbacks.paused();
  }
  /** The first status on a plate whose card the players have not seen, or have seen before it changed: the fight stops for it. */
  function checkGuides() {
    if (!guideReady()) return;
    const seen = callbacks.guides!.seen();
    for (const on of onPlates.values()) for (const id of on.guides) if (guideState(seen, id) !== 'seen') { showGuide(id, on.who); return; }
  }
  function showGuide(id: GuideId, who: string) {
    const card = GUIDES[id], box = root.querySelector<HTMLElement>('.guide-card')!;
    const changed = guideState(callbacks.guides!.seen(), id) === 'changed';
    guideOpen = { id, focus: document.activeElement as HTMLElement | null };
    root.dataset.guide = id;
    box.style.setProperty('--status', card.colour);
    box.querySelector('.guide-card-icon')!.innerHTML = guideIcon(id, statusSvg);
    box.querySelector('.battle-kicker')!.textContent = changed ? 'HA CAMBIADO' : GUIDE_GROUPS[card.group].toUpperCase();
    box.querySelector('h2')!.textContent = card.name;
    box.querySelector('.guide-card-who')!.textContent = `Ahora en ${who}`;
    box.querySelector('p')!.textContent = card.text;
    box.hidden = false;
    callbacks.sound('mark-set');
    box.querySelector<HTMLButtonElement>('.guide-card-ok')!.focus({ preventScroll: true });
  }
  /** Read: it is kept at this version, the fight goes on, and the next card waiting, if any, comes. */
  function closeGuide() {
    if (!guideOpen) return;
    const { id, focus } = guideOpen;
    callbacks.guides?.mark(id, guideVersion(id));
    guideOpen = undefined; delete root.dataset.guide;
    root.querySelector<HTMLElement>('.guide-card')!.hidden = true;
    callbacks.sound('ui-back');
    if (focus?.isConnected && !focus.closest('[hidden]')) focus.focus({ preventScroll: true });
    render();
  }
  /**
   * A timed status's clock: its ring empties and its hand turns as its time runs out, and a notch
   * marks each pulse still to come, where the hand will be when it hurts (`--ticks`).
   */
  function drain(plate: Element, c: Combatant) {
    const pane = state?.light ? plate.querySelector<HTMLElement>('.status-icon[data-status="luz"]') : null;
    if (pane && state?.light) {
      // The ring is the whole walk, each light an arc in its colour; the hand goes round once a walk.
      const walk = state.light.walk ?? 'nave', length = walkLength(walk), now = lightAt(state.light.t, walk);
      pane.style.setProperty('--left', (1 - (state.light.t % length) / length).toFixed(4));
      pane.style.setProperty('--status', LIGHTS[now.light].colour);
      if (pane.dataset.ticks !== walk) {
        pane.dataset.ticks = walk;
        let at = 0;
        const arcs = WALKS[walk].map(step => { const from = at / length * 360; at += step.seconds; return `${LIGHTS[step.light].colour} ${from}deg ${at / length * 360}deg`; });
        pane.style.setProperty('--ticks', `conic-gradient(${arcs.join(', ')})`);
      }
    }
    const tune = c.kind === 'voz' && state?.song ? plate.querySelector<HTMLElement>('.status-icon[data-status="cancion"]') : null;
    if (tune && state?.song) {
      // The ring is the turn of her phrase she is singing, each note an arc in its colour and each
      // silence a gap, in her recording's rhythm; the hand goes round once a turn.
      const turn = turnAt(VOZ_SONG, state.song.t), { length } = turn, now = songNow(state)!;
      tune.style.setProperty('--left', (1 - (state.song.t - turn.start) / length).toFixed(4));
      tune.style.setProperty('--status', now.sounding ? TONES[now.tone].colour : '#7f97a3');
      tune.toggleAttribute('data-sounding', now.sounding);
      const key = turn.start.toFixed(3);
      if (tune.dataset.ticks !== key) {
        tune.dataset.ticks = key;
        const arcs = turn.beats.map((beat, i) => {
          const from = beat.at / length * 360, to = (beat.at + beat.sing) / length * 360, next = (turn.beats[i + 1]?.at ?? length) / length * 360;
          return `#1b1216 ${from}deg, ${TONES[beat.tone].colour} ${from}deg ${to}deg, #1b1216 ${to}deg ${next}deg`;
        });
        tune.style.setProperty('--ticks', `conic-gradient(${arcs.join(', ')})`);
      }
    }
    // Compás: its hand goes round once a beat; a notch at the top (the beat) and one at the bottom (the off-beat).
    const compas = state?.compas !== undefined ? plate.querySelector<HTMLElement>('.status-icon[data-status="compas"]') : null;
    if (compas && state?.compas !== undefined) {
      compas.style.setProperty('--left', (1 - state.compas / ECOS.beat).toFixed(4));
      if (compas.dataset.ticks !== 'compas') {
        compas.dataset.ticks = 'compas';
        compas.style.setProperty('--ticks', 'conic-gradient(#120c0f 0deg 7deg, transparent 7deg 173deg, #f2e2a8 173deg 187deg, transparent 187deg 353deg, #120c0f 353deg)');
      }
    }
    for (const [id, on] of Object.entries(shownTimed(c)).filter(([, on]) => on) as [TimedId, Timed][]) {
      const icon = plate.querySelector<HTMLElement>(`.status-icon[data-status="${id}"]`);
      if (!icon) continue;
      // Made to last longer than it lasts at first (Rayo de energía), the ring measures that.
      const seconds = Math.max(TIMED[id].seconds, on.left), { every } = TIMED[id];
      icon.style.setProperty('--left', Math.max(0, on.left / seconds).toFixed(3));
      // Seconds into its time: the next pulse comes `next` from now, then one every `every`, while it lasts.
      const turns: number[] = [];
      if (TIMED[id].levels.length) for (let t = seconds - on.left + on.next; t < seconds - .01; t += every) turns.push(t / seconds);
      const key = turns.map(turn => turn.toFixed(3)).join(',');
      if (icon.dataset.ticks === key) continue;
      icon.dataset.ticks = key;
      icon.style.setProperty('--ticks', turns.length ? `conic-gradient(${turns.map(turn => { const deg = turn * 360; return `transparent ${deg - 5}deg, #120c0f ${deg - 5}deg ${deg + 5}deg, transparent ${deg + 5}deg`; }).join(', ')})` : 'none');
    }
  }
  /**
   * The fight at a glance (the D-pad's left or right on a pad, R on the keyboard; docs/combat.md § Resumen):
   * each side with its PV, maná, statuses and the stats it has up or down, and why. Either player
   * opens it at any moment and the fight goes on under it; it follows what happens while open.
   */
  let summaryOpen = false, summaryShown = '', summaryAt = 0;
  function toggleSummary(open = !summaryOpen) {
    if (!state || open === summaryOpen || (open && ['won', 'lost', 'escaped'].includes(state.phase) && !busy)) return;
    summaryOpen = open;
    if (open) summaryLearned = true;
    callbacks.sound(open ? 'ui-move' : 'ui-back');
    renderSummary();
  }
  function summaryUnit(c: Combatant, ally: boolean) {
    const s = state!, down = c.hp === 0, ratio = c.hp / c.maxHp;
    const tag = down ? 'Fuera' : c.guarding ? 'En guardia' : s.phase === 'player' && s.allies[s.active] === c ? 'Su turno' : '';
    const anima = !ally ? '' : c.classId ? animaOf(c.classId, grownUp(c.profile)).name : wearsAnimas(c) ? 'Sin ánima' : '';
    // The party's PV in numbers; a foe's only as its bar shows them.
    const health = ally ? `${c.hp} / ${c.maxHp} PV` : down ? 'Fuera de combate' : c.hp === c.maxHp ? 'Salud completa' : ratio <= .3 ? 'Salud baja' : 'Herido';
    const most = ally ? animaMax(c) : 0;
    const mana = most ? `<span class="summary-mana" role="img" aria-label="Maná ${c.secondary} de ${most}">${Array.from({ length: most }, (_, i) => `<i data-pip="${i < c.secondary ? 'full' : 'spent'}"></i>`).join('')}</span>` : '';
    const statuses = statusList(c).map(st => `<li class="summary-status" data-status="${st.id}">${statusSvg(st.id)}<b>${st.name}</b><small>${st.lasts}</small></li>`);
    const rules = ruleChips(c, true).map(([id, text]) => `<li class="summary-rule" data-status="${id}"><b>${escapeHtml(text)}</b></li>`);
    const shifts = statShifts(s, c).map(shift => `<li class="summary-shift" data-way="${shift.way}"><b>${shift.way === 'up' ? '▲' : '▼'} ${shiftText(shift)}</b><small>${escapeHtml([...(shift.rounds ? [rounds(shift.rounds)] : []), ...shift.from].join(' · '))}</small></li>`);
    const colour = ally && c.classId ? CLASSES[c.classId].colour : '';
    return `<article class="summary-unit" data-side="${ally ? 'allies' : 'foes'}"${down ? ' data-down' : ''}${colour ? ` style="--chip:${colour}"` : ''}>
      <div class="summary-name"><strong>${escapeHtml(c.name)}</strong>${anima ? `<span>${escapeHtml(anima)}</span>` : ''}${tag ? `<em>${tag}</em>` : ''}</div>
      <div class="summary-health"><span class="summary-bar"><i style="width:${(ratio * 100).toFixed(1)}%"></i></span><small>${health}</small>${mana}</div>
      ${down ? '' : statuses.length + rules.length + shifts.length ? `<ul class="summary-tags">${[...statuses, ...rules].join('')}</ul>${shifts.length ? `<ul class="summary-tags is-secondary">${shifts.join('')}</ul>` : ''}` : '<p class="summary-none">Sin estados</p>'}
    </article>`;
  }
  function renderSummary() {
    const box = get('.battle-summary'), over = !state || (!busy && ['won', 'lost', 'escaped'].includes(state.phase));
    if (over) summaryOpen = false;
    get('.summary-key').hidden = summaryLearned || over || !!root.dataset.entering;
    box.hidden = !summaryOpen;
    if (!summaryOpen || !state) { summaryShown = ''; return; }
    const s = state, actor = s.allies[s.active];
    const turn = s.phase === 'player' && !busy ? `Turno de ${escapeHtml(actor.name)}` : s.phase === 'beat' ? '…' : busy || s.phase === 'enemy' ? 'En acción' : '';
    const html = `<header><span class="battle-kicker">RESUMEN DEL COMBATE</span><h2>Ronda ${s.round}</h2>${turn ? `<p>${turn}</p>` : ''}</header>
      <div class="summary-sides">
        <section aria-label="Tu equipo"><h3 class="battle-kicker">TU EQUIPO</h3>${s.allies.map(c => summaryUnit(c, true)).join('')}</section>
        <section aria-label="Enemigos"><h3 class="battle-kicker">ENEMIGOS</h3>${s.foes.filter(c => !c.part || c.hp > 0).map(c => summaryUnit(c, false)).join('')}</section>
      </div>
      <footer data-glyph-template="{summary} · {cancel} cerrar"></footer>`;
    if (html === summaryShown) return;
    summaryShown = html;
    box.innerHTML = html;
  }
  /**
   * The fight's clock (docs/combat.md § Estados en tiempo real): real time, while the players
   * choose and while everyone acts. It stands still while the fight comes in, through the story's
   * own moments (the palace beat), while a foe's move is named before it moves (BEAT.announce),
   * once it is over and while the pause menu is open.
   */
  let clockFrame = 0, clockLast = 0;
  /**
   * A dual's banner slows the fight's clock as it slows the 3D fight (`callbacks.slowmo`): DUAL_SLOW
   * until `slowUntil`, then back to full speed over DUAL_EASE.
   */
  let slowUntil = 0;
  const clockScale = (now: number) => now < slowUntil ? DUAL_SLOW : Math.min(1, DUAL_SLOW + (1 - DUAL_SLOW) * (now - slowUntil) / (DUAL_EASE * 1000));
  function slowDown(seconds: number) {
    callbacks.slowmo?.(DUAL_SLOW, seconds);
    slowUntil = performance.now() + seconds * 1000;
  }
  function tickClock(now: number) {
    clockFrame = requestAnimationFrame(tickClock);
    // A hidden tab or a long frame never burns a fight away at once.
    // As fast as the 3D fight runs (a dual's banner, Punto débil's aim slowing it further), or the banner's own slow.
    const rate = callbacks.speed?.() ?? clockScale(now), seconds = Math.min(.1, Math.max(0, (now - clockLast) / 1000)) * rate; clockLast = now;
    const stopped = !state || !!root.dataset.entering || !!root.dataset.beat || !!root.dataset.announcing || !!root.dataset.revealing || !!root.dataset.guide || callbacks.paused();
    if (state?.song && !['won', 'lost', 'escaped'].includes(state.phase)) callbacks.song?.(state.song.t, stopped ? 0 : rate);
    if (!state || stopped) return;
    const pulses = runClock(state, seconds, c => heldFire.has(c.id));
    const sung = showSong() || showLight() || showEcos();
    // What a pulse brought on (Vertitrón's eye burnt out) plays once nothing else is.
    if (state.news?.length && !busy) void showNews();
    // Siete vidas went off on something that had no number of its own to turn over (a note of La Voz's): it says so now.
    if (!busy) for (const ally of state.allies) if (ally.lives?.spent) livesPop(ally.lives.spent.target, ally.lives.spent);
    for (const c of [...state.foes, ...state.allies]) { const plate = root.querySelector(`.battle-target[data-target="${c.id}"]`); if (plate) drain(plate, c); }
    if (summaryOpen && now - summaryAt > 250) { summaryAt = now; renderSummary(); }
    checkGuides();
    if (!pulses.length) { if (sung) render(); return; }
    // Corriente alterna's beat sounds as its own string, plucked by the scene (src/duo-fx/corriente-alterna.ts).
    if (pulses.some(p => !p.heal && p.status !== 'alterna')) callbacks.sound('burn');
    if (pulses.some(p => p.heal)) callbacks.sound('heal');
    for (const p of pulses) {
      // A cure's pulse (Sanación) gives PV back: its number in green, no flare on the body.
      if (p.heal) { if (p.amount) pop(p.target, `+${p.amount}`, 'heal', `${TIMED[p.status].name} ${roman(p.level)}`); if (p.mended) pop(p.target, `Cúpula +${p.mended}`, 'status', 'Se recompone', 'bits'); }
      // Siete vidas took the pulse that would have killed them: it turns into a cure.
      else if (p.saved) livesPop(p.target, p.saved);
      // La crecida's pulses come off in their own colour: the current's yellow, the sinking's blue-green.
      // A Bomba remota went off: its number with its own word, and the scene blows it up.
      // It implodes first (src/bomb.ts `BOMB.implode`, 0.8 s): the number comes with the burst.
      else if (p.blast) { const blast = p, when = generation; setTimeout(() => { if (when === generation) { pop(blast.target, `−${blast.amount}`, 'damage', '¡Estalla!'); if (blast.awoken) ultiAwoke(blast.awoken); } }, 800); callbacks.pulse(p.target, p.status, p.by); }
      else if (p.status === 'corriente' || p.status === 'hundido') { pop(p.target, `−${p.amount}`, 'damage', p.status === 'hundido' ? TIMED.hundido.name : `${TIMED[p.status].name} ${roman(p.level)}`, p.status); callbacks.pulse(p.target, p.status, p.by); }
      // Corriente alterna's beat: its number named after the circuit (it has no level: the beat is not one), set aside when
      // the reaction's own number on the same foe comes after it.
      else if (p.status === 'alterna') { pop(p.target, `−${p.amount}`, 'damage', TIMED.alterna.name, undefined, p.reaction?.hits?.some(h => h.target === p.target) ? -48 : 0); callbacks.pulse(p.target, p.status, p.by, p); }
      else { pop(p.target, `−${p.amount}`, 'damage', `${TIMED[p.status].name} ${roman(p.level)}`); callbacks.pulse(p.target, p.status, p.by); }
      if (p.status === 'alterna') beatSays(p);
      // Its clock flashes as the notch it reached hurts.
      root.querySelectorAll<HTMLElement>(`[data-target="${p.target}"] .status-icon[data-status="${p.status}"], [data-unit="${p.target}"] .status-icon[data-status="${p.status}"]`).forEach(icon => { icon.classList.remove('is-pulsing'); void icon.offsetWidth; icon.classList.add('is-pulsing'); });
    }
    // A fire can end the fight on its own: the result shows once nothing is being played.
    render();
  }
  /**
   * What Corriente alterna's beat turned, after its number: the reaction's name over the foe it struck and the PV it took
   * from each it reached, beside the beat's own; then, one after another in the same place once the name has gone, whoever
   * it left in Shock and the water it left charged (La crecida's Corriente); the passives over whoever has them, a cortina
   * it raised, and a definitiva it woke.
   */
  function beatSays(p: TimedPulse) {
    const when = generation, later = (ms: number, show: () => void) => setTimeout(() => { if (when === generation) show(); }, ms);
    const queued = new Map<string, number>(), after = (id: string) => { const n = queued.get(id) ?? 0; queued.set(id, n + 1); return 1600 + n * 1400; };
    if (p.reaction) {
      const says = reactionSays(p.reaction), on = p.target;
      later(220, () => pop(on, says.text, 'status', says.detail, says.id));
      p.reaction.hits?.forEach((h, i) => later(360 + i * 90, () => pop(h.target, `−${h.amount}`, 'damage', says.text.replace(/[¡!]/g, ''), undefined, h.target === on ? 52 : 58)));
      p.reaction.targets?.forEach((id, i) => { if (id !== on) later(360 + i * 90, () => pop(id, says.text, 'status', says.detail, says.id)); });
    }
    for (const id of p.current?.targets ?? []) { const c = p.current!; later(after(id), () => pop(id, c.renewed ? 'Corriente' : '¡Corriente!', 'status', c.renewed ? `Otra vez ${c.seconds} s` : `${c.seconds} s`, 'corriente')); }
    for (const id of p.shocked ?? []) later(after(id), () => pop(id, '¡Shock!', 'status', 'Pierde su siguiente turno', 'shock'));
    for (const id of p.cortina ?? []) later(400, () => pop(id, 'Cortina', 'status', 'El siguiente golpe, a la mitad', 'cortina'));
    p.passives?.forEach((n, i) => later(700 + i * 260, () => {
      pop(n.who, n.name, 'passive', p.mana && n.id === 'toma-de-tierra' ? 'Pasiva · Maná +1' : 'Pasiva')?.style.setProperty('--anima', CLASSES[PASSIVES[n.id].anima].colour);
      callbacks.sound('mark-set');
    }));
    if (p.awoken) { const awoken = p.awoken; later(900, () => ultiAwoke(awoken)); }
  }
  /**
   * Sincopante's ecos on their own (`takeEcoNews`): each note's number on whoever it reached, named
   * *Eco*; Marta's voice in them (a grain each, under the music; none while muffled); three at once
   * waking Da capo; and the 3D fight shows each one sound or go (`callbacks.ecos`). Returns whether the
   * plates have something new to say.
   */
  const ECO_VOICES = ['eco-fa', 'eco-la', 'eco-do'] as const;
  function showEcos() {
    if (!state) return false;
    const news = takeEcoNews(state);
    if (!news.length) return false;
    const sung = new Set<typeof ECO_VOICES[number]>();
    for (const item of news) {
      if (item.kind === 'pulse') {
        const name = item.accent ? 'Eco · a contratiempo' : item.muffled ? 'Eco · apagado' : 'Eco';
        item.hits.forEach((hit, i) => {
          if (hit.heal) { if (hit.amount) pop(hit.target, `+${hit.amount}`, 'heal', name, undefined, i * 16); }
          else if (hit.amount) { pop(hit.target, `−${hit.amount}`, 'damage', name, undefined, i * 16); callbacks.pulse(hit.target); }
        });
        const index = state.ecos?.findIndex(e => e.id === item.eco) ?? -1;
        if (!item.muffled) sung.add(ECO_VOICES[Math.max(0, index) % 3]);
      } else if (item.kind === 'chord' && item.awoken) {
        const wearer = state.allies.find(a => a.hp > 0 && a.classId === 'sincopante');
        if (wearer) { pop(wearer.id, 'Da capo', 'passive', 'Definitiva · despierta')?.style.setProperty('--anima', CLASSES.sincopante.colour); callbacks.sound('mark-set'); }
      }
    }
    for (const id of sung) callbacks.sound(id);
    callbacks.ecos?.(news);
    return true;
  }
  /**
   * La Voz's song is a status on her, continuous, drawn like a fire's clock (`statusList`, `drain`):
   * nothing else on screen tells it. Here, what the song did since the last frame: each note she
   * starts is a move of hers, its number on whoever its beam reached (named after the note, with its
   * element), and what it left on them a beat later; a Crescendo over her. The beam itself is the
   * scene's. Returns whether the plates have something new to say.
   */
  let songSaid = '';
  function showSong() {
    if (!state?.song || ['won', 'lost', 'escaped'].includes(state.phase)) return false;
    const voz = state.foes.find(f => f.kind === 'voz');
    const news = takeSongNews(state);
    for (const item of news) {
      if (item.kind === 'nota') {
        // No note is played here: her recording is the song, and it is playing (`callbacks.song`).
        const name = FOE_ABILITIES[item.ability].name, kind = item.element ? `${name} · ${ELEMENTS[item.element].name}` : vozNote(item.tone).physical ? `${name} · Físico` : name;
        const token = generation;
        item.hits.forEach((hit, i) => {
          if (hit.missed) { missPop(hit.target, i * 16); return; }
          if (hit.amount) { pop(hit.target, `−${hit.amount}`, 'damage', hit.conducted && item.hits.length > 1 && i ? 'Conducción' : hit.angry ? `${kind} · Enfado${hit.guarded ? ' · Protegido' : ''}` : hit.guarded ? `${kind} · Protegido` : kind, undefined, i * 16); callbacks.pulse(hit.target); }
          // What it left on them, a beat after the number, in its colour.
          const left = hit.wet ? { id: 'mojado', text: `¡${TIMED.mojado.name}!`, detail: '' } : hit.burn ? { id: 'quemado', text: `¡${TIMED.quemado.name}${hit.burn > 1 ? ` ${roman(hit.burn)}` : ''}!`, detail: hit.burn > 1 ? 'El fuego sube' : '' }
            : hit.dried ? { id: 'mojado', text: 'Seco', detail: 'El fuego se lleva el agua' } : hit.conducted && !i ? { id: 'conduccion', text: '¡Conducción!', detail: 'Corre por el agua' } : undefined;
          if (left) setTimeout(() => { if (token === generation) pop(hit.target, left.text, 'status', left.detail, left.id); }, 170);
        });
        item.shocked?.forEach(id => setTimeout(() => { if (token === generation) pop(id, '¡Shock!', 'status', 'Pierde su siguiente turno', 'shock'); }, 340));
        // Heard only where it leaves something: the water, the fire catching, the bolt in the water, her Re's weight.
        const hit = item.hits.find(h => !h.guarded);
        if (item.conducted) callbacks.sound('zap');
        else if (hit?.wet) callbacks.sound('splash');
        else if (hit?.burn) callbacks.sound('fire-hit');
        else if (hit && vozNote(item.tone).physical) callbacks.sound('thump');
        // Her icon flashes as the note starts, as a fire's does when it burns.
        root.querySelectorAll<HTMLElement>('.status-icon[data-status="cancion"]').forEach(icon => { icon.classList.remove('is-pulsing'); void icon.offsetWidth; icon.classList.add('is-pulsing'); });
      } else if (item.kind === 'crescendo' && voz) pop(voz.id, 'Crescendo', 'status', roman(item.level), 'crescendo');
      // A new turn of her phrase, for someone else: whoever touched her last.
      else if (item.kind === 'mira') pop(item.target, 'Le canta', 'status', 'Toda esta vuelta', 'canta');
    }
    // The plate says it again when the note changes (the icon's colour is set every frame, `drain`).
    const said = `${songLabel(state) ?? ''}${state.song.part}${voz?.crescendo ?? 0}`;
    const changed = said !== songSaid || news.length > 0;
    songSaid = said;
    return changed;
  }
  /**
   * Fran's salon: the light came round to a new colour. Over each of the party, what it is and what
   * it eats now, and their window flashes (its colour is set every frame, `drain`).
   */
  function showLight() {
    if (!state?.light || ['won', 'lost', 'escaped'].includes(state.phase)) return false;
    const news = takeLightNews(state);
    const light = news.at(-1);
    if (!light) return false;
    // A pane of the window rings, its own note for each colour (src/sfx.ts `pane`).
    callbacks.sound(`luz-${light}`);
    for (const ally of state.allies.filter(a => a.hp > 0)) {
      const el = pop(ally.id, `Luz ${LIGHTS[light].name.toLowerCase()}`, 'status', lightEats(state, light), 'luz');
      el?.style.setProperty('--status', LIGHTS[light].colour);
    }
    root.querySelectorAll<HTMLElement>('.status-icon[data-status="luz"]').forEach(icon => { icon.classList.remove('is-pulsing'); void icon.offsetWidth; icon.classList.add('is-pulsing'); });
    // La carta de colores: the shirt of that colour is in its light now.
    for (const foe of state.foes) if (foe.hp > 0 && foe.kind === `estampado-${light}`) pop(foe.id, 'En su luz', 'status', '', 'en-su-luz');
    return true;
  }
  function startClock() { cancelAnimationFrame(clockFrame); clockLast = performance.now(); clockFrame = requestAnimationFrame(tickClock); }
  /** A line said over a fighter's head, inside the fight (the rest of the HUD is shut). */
  async function speak(line: { speaker: keyof typeof SPEAKERS; text: string }, ms: number, shout = false, over: string = line.speaker) {
    const at = positions.get(over);
    const el = document.createElement('p');
    el.className = 'battle-speech-line'; el.dataset.speaker = line.speaker; if (shout) el.dataset.shout = 'true';
    el.innerHTML = '<span></span>';
    el.querySelector('span')!.textContent = line.text;
    el.style.setProperty('--accent', SPEAKERS[line.speaker].accent);
    // Never off the top of the screen (Uri up on Vertitrón): a bubble that would be stays just under the heading.
    // Nor off its sides (Aitor out of the last scene's close shot): it comes in from the side he is on.
    const side = Math.min(160, root.clientWidth / 4), x = at && Math.min(root.clientWidth - side, Math.max(side, at.x));
    if (at) el.style.transform = `translate(${x}px, ${Math.min(root.clientHeight * .8, Math.max(at.y - 40, shout ? 130 : 90))}px) translate(-50%, -100%)`;
    get('.battle-speech').append(el);
    await wait(ms);
    el.dataset.leaving = 'true';
    setTimeout(() => el.remove(), 300);
  }
  /**
   * The palace minion is about to finish Bernat: he cries out, then tells Gerard to think, to do
   * the magic with his mind. Matemágico wakes up (the fight shows it, the story records it) and
   * the interface takes on its colours.
   */
  async function playBeat(token: number) {
    if (!state) return;
    root.dataset.beat = 'true';
    render();
    await wait(500);
    await speak(BATTLE_LINES.aboutToDie, 1900);
    if (token !== generation || !state) return;
    root.dataset.shaking = 'true';
    const shout = speak(BATTLE_LINES.think, 2600, true);
    await wait(1500);
    if (token !== generation || !state) return;
    callbacks.awaken('matemagico');
    awaken(state, 'matemagico');
    render(); flashAnima(root.querySelector('.party-card[data-unit="gerard"] .vitals-avatar'), CLASSES.matemagico.colour);
    await shout;
    delete root.dataset.shaking;
    if (token !== generation || !state) return;
    const banner = get('.class-banner');
    banner.dataset.anima = 'matemagico';
    banner.querySelector('h2')!.textContent = CLASSES.matemagico.name;
    banner.querySelector('p')!.textContent = CLASSES.matemagico.motto;
    banner.hidden = false;
    await holdUntilConfirm();
    banner.hidden = true;
    delete root.dataset.beat;
    // The one new thing on screen: Habilidades pulses until it is opened.
    get('[data-command="skill"]').classList.add('is-new');
  }
  /** Maná shows once the party has an ánima to spend it with (chapter 1 has none until the palace). */
  const animaMax = (c: Combatant) => state?.animas.length ? c.maxSecondary : 0;
  /**
   * Atacar's block, split in one segment for each element the ánima worn has and one for none: X (the
   * top face button) walks them, a click picks one, and the one chosen dresses the block in its colour.
   * Nothing says which one reacts with what: that is for the player to find out.
   */
  function showElements() {
    const s = state!, actor = s.allies[s.active], list = elementsFor(s, actor), on = attackElement(s, actor);
    const box = get('.attack-elements'), article = get('[data-command="attack"]');
    box.hidden = !list.length;
    article.toggleAttribute('data-split', !!list.length);
    if (box.dataset.for !== list.join()) {
      box.dataset.for = list.join();
      box.innerHTML = (['', ...list] as (AttackElement | '')[]).map(id => `<button type="button" tabindex="-1" data-element="${id}" title="${id ? ELEMENTS[id].name : 'Sin elemento'}" aria-label="${id ? ELEMENTS[id].name : 'Sin elemento'}"${id ? ` style="--element:${ELEMENTS[id].colour}"` : ''}><svg viewBox="0 0 16 16" aria-hidden="true">${ELEMENT_ICONS[id || 'none']}</svg></button>`).join('') + '<kbd class="attack-element-key" data-glyph="element"></kbd>';
    }
    const off = blocked('attack');
    box.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.setAttribute('aria-pressed', String((button.dataset.element || undefined) === on)); button.disabled = off; });
    box.querySelector<HTMLElement>('.attack-element-key')?.toggleAttribute('hidden', elementLearned);
    if (on) { article.dataset.element = on; article.style.setProperty('--element', ELEMENTS[on].colour); }
    else { delete article.dataset.element; article.style.removeProperty('--element'); }
    get('.attack-element-name').textContent = on ? ELEMENTS[on].name : '';
    if (targeting && selected === 'attack') get('.target-picker h2').textContent = attackName(actor);
  }
  /** What Atacar is called with the element it carries now. */
  const attackName = (c: Combatant) => { const on = attackElement(state!, c); return on ? `Atacar · ${ELEMENTS[on].name}` : 'Atacar'; };
  /** X on the commands, or while aiming Atacar: its next element. */
  function nextElement(actor: Combatant) {
    if (!cycleElement(state!, actor)) return false;
    elementLearned = true;
    callbacks.sound('ui-move');
    render();
    return true;
  }
  const plate = (c: Combatant) => vitalsPlate({ id: c.id, name: c.name, profile: c.profile, hp: c.hp, maxHp: c.maxHp, sec: c.secondary, maxSec: animaMax(c), anima: c.classId && animaOf(c.classId, grownUp(c.profile)).name, colour: c.classId && CLASSES[c.classId].colour, scarf: c.classId && CLASSES[c.classId].scarf });
  /** A card's face and ánima: redrawn when the fighter changes ánima, the bars stay and glide. */
  function dress(card: HTMLElement, c: Combatant) {
    const fresh = document.createElement('div'); fresh.innerHTML = plate(c);
    const next = fresh.firstElementChild as HTMLElement, old = card.querySelector<HTMLElement>('.vitals')!;
    old.querySelector('.vitals-avatar')!.replaceWith(next.querySelector('.vitals-avatar')!);
    old.querySelector('.vitals-tag')!.textContent = next.querySelector('.vitals-tag')!.textContent;
    old.style.cssText = next.style.cssText;
    card.dataset.anima = c.classId ?? 'none';
  }
  /**
   * Each ánima's maná on its pill, as little circles: the one worn spends it, the others keep theirs
   * and get some back while they rest (`REST_CHARGE`). Three to a row, so six fit in two.
   */
  function chipMana(button: HTMLButtonElement, owner: Combatant, id: ClassId) {
    const most = manaMax(state?.improved, id, state?.levels), left = id === owner.classId ? owner.secondary : owner.mana?.[id] ?? most;
    const box = button.querySelector<HTMLElement>('.chip-mana');
    if (!box) return;
    box.hidden = !most;
    box.toggleAttribute('data-dice', id === DICED);
    if (box.childElementCount !== most) { box.innerHTML = '<i></i>'.repeat(most); box.style.setProperty('--columns', String(Math.min(3, most))); }
    box.querySelectorAll('i').forEach((pip, i) => {
      const next = i < left ? 'full' : 'spent';
      // A circle filling or emptying since the last redraw pops or fades, as on the vitals plate.
      if (pip.dataset.pip && pip.dataset.pip !== next) { pip.classList.remove('is-changing'); void pip.offsetWidth; pip.classList.add('is-changing'); }
      pip.dataset.pip = next;
    });
    button.setAttribute('aria-label', `${button.querySelector('.chip-label')!.textContent}, maná ${left} de ${most}`);
  }
  /** Opens or closes the details window; it follows focus through the skills while open. */
  function showDetails(open: boolean) {
    details = open && (selected === 'skill' || selected === 'dual') && !targeting;
    if (details && !detailsLearned) { detailsLearned = true; get('.flyout-hint').dataset.learned = 'true'; }
    placeDetails();
  }
  function placeDetails() {
    const box = get('.skill-info');
    const near = cursor(), button = near && (near.dataset.skill || near.dataset.dual) ? near : undefined;
    const skill = button && SKILLS.find(s => s.id === button.dataset.skill);
    // Development: a dual's details, with its combined cost (each half under whoever pays it).
    const dual = button && DUALS.find(d => d.id === button.dataset.dual);
    const option = dual && state ? dualOptions(state, true).find(o => o.dual === dual) : undefined;
    box.hidden = !details || (!skill && !dual) || !state;
    if (box.hidden || !state) { button?.removeAttribute('aria-describedby'); return; }
    button!.setAttribute('aria-describedby', 'skill-info');
    box.querySelector('h3')!.textContent = skill?.name ?? dual!.name;
    box.querySelector('p')!.textContent = skill?.description ?? dual!.description;
    box.querySelector('.skill-info-cost')!.innerHTML = skill ? `MANÁ ${costPips(skill.cost)}` : `${dualTotal(dual!)} ${dualPips(dual!, id => option ? wearerOf(option, id)?.name ?? '' : '')}`;
    // Beside the skill, out past the flyout, vertically centred on it (to its left in Aitor's mirrored dock).
    const base = root.getBoundingClientRect(), at = button!.getBoundingClientRect(), sheet = get('.skill-flyout').getBoundingClientRect();
    box.dataset.side = mirrored() ? 'left' : 'right';
    box.style.left = mirrored() ? `${Math.min(at.left, sheet.left) - base.left - 18 - box.offsetWidth}px` : `${Math.max(at.right, sheet.right) - base.left + 18}px`;
    box.style.top = `${at.top + at.height / 2 - base.top}px`;
  }
  /**
   * Two real players (Aitor's turns belong to player 2) split the bottom of the screen: Gerard's
   * dock on the left, Aitor's on the right, each with their own vitals, ánima and commands on their
   * turn. Alone (chapter 1, or the development `solo` mode) one dock follows whoever's turn it is.
   */
  const split = () => !!state && state.allies.some(a => callbacks.driver(a.id) === 2);
  /** A dual the players have found (kept, or already played this session): only then is it armed while aimed. */
  const knownDual = (id: DualId) => seenDuals.has(id) || !!callbacks.known?.(id);
  const dockOf = (allyId: string) => get(`.battle-dock[data-dock="${split() ? callbacks.driver(allyId) : 1}"]`);
  /** Whose dock it is: in a split fight its player's fighter, alone whoever's turn it is. */
  const ownerOf = (dock: HTMLElement) => !state ? undefined : split() ? state.allies.find(a => callbacks.driver(a.id) === Number(dock.dataset.dock)) : state.allies[state.active];
  /** Whether the commands sit in Aitor's dock, which mirrors the menu (skills open to the left). */
  const mirrored = () => !!state && split() && ctx === 2;
  /** Whose hands the current turn is in; nobody else's input counts. */
  const turnDriver = (): PlayerId => state && split() ? ctx : state && state.phase === 'player' ? callbacks.driver(state.allies[state.active].id) : 1;
  /**
   * Two players choose at once (docs/combat.md § Turno del equipo): each has their own menu — what is
   * picked, the skill, the dual, whether they are aiming — and their own cursor. `withPlayer` puts
   * one player's menu in the working variables (and their fighter in the turn) while it runs.
   */
  interface Menu { selected?: Command; selectedSkill?: SkillId; selectedDual?: DualId; targeting: boolean; pickingDie?: SkillId; selectedDie?: number }
  const menus: Record<PlayerId, Menu> = { 1: { targeting: false }, 2: { targeting: false } };
  const keepMenu = () => { menus[ctx] = { selected, selectedSkill, selectedDual, targeting, pickingDie, selectedDie }; };
  const loadMenu = (p: PlayerId) => { ctx = p; ({ selected, selectedSkill, selectedDual, targeting, pickingDie, selectedDie } = menus[p]); };
  const allyOf = (p: PlayerId) => state?.allies.find(a => callbacks.driver(a.id) === p);
  /** An action confirmed while another one plays: it goes off as soon as that one is over, in the order confirmed. */
  /** A confirmed choice waiting its turn to play; `at`: when it was pressed on La Voz's song, the moment it is judged at. */
  interface Job { player: PlayerId; ally: string; command: Command; skill?: SkillId; die?: number; dual?: DualId; target?: string; text: string; at?: number }
  const pending: Job[] = [];
  /** Whether `ally` can still choose this round: standing, not through yet, nothing confirmed waiting to go off. */
  const canAct = (ally: Combatant | undefined) => !!state && !!ally && state.phase === 'player' && ally.hp > 0 && !state.spent?.includes(ally.id) && !pending.some(j => j.ally === ally.id) && !callbacks.waiting(ally.id);
  /** Whether the menu being worked on is shut now: split, its fighter cannot choose; alone, something is playing. */
  const locked = () => !state || (split() ? !canAct(allyOf(ctx)) : busy);
  function withPlayer<T>(p: PlayerId, run: () => T, keepTurn = false): T {
    if (!state || !split()) return run();
    const before = ctx, turn = state.active;
    keepMenu(); loadMenu(p);
    const ally = allyOf(p);
    if (ally && canAct(ally)) takeTurn(state, ally.id);
    try { return run(); } finally { keepMenu(); loadMenu(before); if (keepTurn && state && state.phase === 'player') state.active = turn; }
  }
  /** Each player's cursor: player 1 also has the page's focus (keyboard and mouse); player 2's is drawn (`.is-cursor-2`). */
  const cursors: Partial<Record<PlayerId, HTMLButtonElement>> = {};
  function focusOn(button?: HTMLButtonElement | null) {
    if (!button) return;
    const p: PlayerId = state && split() ? ctx : 1;
    cursors[p]?.classList.remove(`is-cursor-${p}`);
    cursors[p] = button; button.classList.add(`is-cursor-${p}`);
    if (p === 1) button.focus({ preventScroll: true });
    if (targeting && button.dataset.target && !button.disabled) highlight(button.dataset.target);
    if (button.parentElement?.classList.contains('skill-list')) keepInView(button);
  }
  function cursor(): HTMLButtonElement | undefined {
    const p: PlayerId = state && split() ? ctx : 1, active = document.activeElement;
    if (p === 1 && active instanceof HTMLButtonElement && root.contains(active)) return active;
    const mine = cursors[p];
    return mine?.isConnected ? mine : undefined;
  }
  /** Whom the menu being worked on can pick now: split, the other player's aim (a cure, a foe) is not this one's. */
  const ownTargets = () => !state || !targeting || !selected ? [] : (aimedDual() ? dualTargets(state, aimedDual()!) : validTargets(state, selected === 'dual' ? 'attack' : selected, aimSkill())).map(c => c.id);
  const targetButtons = () => { const mine = ownTargets(); return [...root.querySelectorAll<HTMLButtonElement>('.roster-target:not(:disabled), .battle-target[data-side="foes"]:not(:disabled)')].filter(button => !button.hidden && mine.includes(button.dataset.target!)); };
  /** A fighter's nameplate over their head (PV, maná for the party, statuses); a foe's is also how it is picked. */
  function plateHtml(f: Combatant, i: number, foe: boolean) {
    // Her pupils and she are her pink; those she holds (Aurelià, Dirección), possession's violet.
    const colour = f.kind === 'minion' || f.kind === 'guardian' ? '#ff6fae' : f.kind === 'vertigo-ojo' || f.kind === 'aurelia' || f.kind === 'directiva' ? '#b07aff' : isCastle(f.kind) ? '#ff6fae' : DOG_PROFILES[i]?.collar ?? '#b9dba1';
    return `<button class="battle-target" type="button" tabindex="-1" data-target="${f.id}" ${foe ? `data-unit="${f.id}"` : ''} data-side="${foe ? 'foes' : 'allies'}" style="--dog-color:${colour}" aria-label="Elegir a ${f.name}" hidden disabled>${foe && (isSobremesa(f.kind) || isCastle(f.kind)) ? `<span class="plate-name" aria-hidden="true">${f.name}</span>` : ''}<span class="enemy-health" aria-hidden="true"><b style="width:100%"></b><i style="width:100%"></i></span>${foe || !f.maxSecondary ? '' : `<span class="plate-pips" aria-hidden="true">${'<i data-pip="full"></i>'.repeat(f.maxSecondary)}</span>`}</button>`;
  }
  /** Every foe gets its plate, with the other foes'; one no longer in the fight loses it. */
  function ensurePlates() {
    const box = get('.battle-targets');
    box.querySelectorAll<HTMLElement>('.battle-target[data-side="foes"]').forEach(plate => { if (!state!.foes.some(f => f.id === plate.dataset.target)) plate.remove(); });
    state!.foes.forEach((f, i) => {
      if (box.querySelector(`.battle-target[data-target="${f.id}"]`)) return;
      const ally = box.querySelector('.battle-target[data-side="allies"]');
      if (ally) ally.insertAdjacentHTML('beforebegin', plateHtml(f, i, true)); else box.insertAdjacentHTML('beforeend', plateHtml(f, i, true));
    });
  }
  /**
   * Draws the fight. The screen once; then each menu: alone the one, split each player's in their
   * own dock (`withPlayer`), and the targets anyone is aiming at can be picked.
   */
  function render() {
    if (!state) return;
    keepMenu();
    renderScreen();
    const panels = !split() ? [renderPanel()] : ([1, 2] as PlayerId[]).map(p => withPlayer(p, renderPanel, true));
    const eligible = panels.flatMap(a => a.eligible), cure = panels.some(a => a.cure);
    // Split, one can aim a cure while the other aims at a foe: then both sides stay pickable ('both').
    const atFoes = panels.some(a => a.aiming && !a.cure), atAllies = panels.some(a => a.aiming && a.cure);
    if (atFoes || atAllies) root.dataset.targeting = atFoes && atAllies ? 'both' : atAllies ? 'allies' : 'foes'; else delete root.dataset.targeting;
    root.querySelectorAll<HTMLButtonElement>('[data-target]').forEach(button => {
      button.disabled = !eligible.includes(button.dataset.target!);
      if (button.classList.contains('battle-target')) button.tabIndex = button.disabled ? -1 : 0;
      if (button.classList.contains('roster-target')) button.hidden = !cure;
      button.closest('[data-unit]')?.classList.toggle('is-eligible', !button.disabled);
    });
    renderSummary();
    armDualBanner();
    reaim();
    checkGuides();
  }
  /**
   * Split, the partner's move can take an aim away from under a player (the foe falls, a cure is no
   * longer needed): their cursor moves on to whom they can still pick, or back out if nobody is left,
   * instead of sitting on a plate their confirm no longer works on.
   */
  let reaiming = false;
  function reaim() {
    if (!state || !split() || reaiming) return;
    reaiming = true;
    try {
      // A dual whose other half can no longer choose (fallen to a burn, a pad gone): it is off, and the
      // one left goes back to aiming their own skill instead of waiting for good.
      const out = duo && state.phase === 'player' ? ([1, 2] as PlayerId[]).find(p => !canAct(allyOf(p))) : undefined;
      if (duo && out) {
        const theirs = duo.skills[other(out)];
        duo = undefined;
        withPlayer(out, () => collapse(), true);
        withPlayer(other(out), () => { selected = 'skill'; selectedSkill = theirs; selectedDual = undefined; targeting = true; }, true);
        render();
      }
      for (const p of [1, 2] as PlayerId[]) withPlayer(p, () => {
        if (!targeting || locked() || !aimedBy[p]) return;
        // By the rules, not by the plates: one out of the camera's sight for a moment is still theirs.
        const ids = ownTargets();
        if (ids.includes(aimedBy[p]!)) return;
        if (ids.length) focusOn(targetButtons()[0]); else back();
      }, true);
    } finally { reaiming = false; }
  }
  /** The menu being worked on (`ctx`): its commands, its target picker, its help line; and what it is aiming at. */
  function renderPanel() {
    const s = state!, actor = split() ? allyOf(ctx) ?? s.allies[s.active] : s.allies[s.active];
    get('.turn-label').textContent = actor.name;
    const waiting = !busy && s.phase === 'player' && callbacks.waiting(actor.id);
    get('.turn-meta').textContent = (split() ? !canAct(actor) : busy) || s.phase === 'enemy' ? 'EN ACCIÓN' : waiting ? 'CONECTA EL MANDO 2' : callbacks.driver(actor.id) === 2 ? 'MANDO 2' : 'TU TURNO';
    if (!split()) { root.dataset.player = String(turnDriver()); root.toggleAttribute('data-waiting', waiting); }
    articles().forEach(article => {
      article.querySelector<HTMLButtonElement>('.command-trigger')!.disabled = blocked(article.dataset.command as Command);
      // Huir is only in the menu of a fight the party can walk away from (`FLEEABLE`; every one in development).
      if (article.dataset.command === 'escape') article.hidden = !escapeShown(s);
    });
    showElements();
    const aiming = targeting && !locked() && s.phase === 'player';
    const dual = aimedDual();
    const eligible = aiming ? (dual ? dualTargets(s, dual) : validTargets(s, selected === 'dual' ? 'attack' : selected!, aimSkill())).map(c => c.id) : [];
    const cure = dual?.side === 'allies' || aiming && selected === 'skill' && !!aimSkill() && toParty(aimSkill()!);
    get('.command-deck').hidden = targeting;
    get('.target-picker').hidden = !targeting;
    if (targeting) pickerText();
    // Keys for the device in use (input-glyphs.ts fills the template).
    get('.command-help').dataset.glyphTemplate = targeting ? '{arrows} elegir · {confirm} aplicar · {cancel} volver'
      : selected === 'skill' || selected === 'dual' ? '{updown} elegir · {confirm} usar · {details} detalles · {cancel} volver'
      : `{${({ 3: 'pickFew', 4: 'pick', 5: 'pickDev' } as const)[COMMANDS.length - (escapeShown(s) ? 0 : 1)] ?? 'pick'}} elegir · {confirm} confirmar · {prev} {next} ánima${elementsFor(s, actor).length ? ' · {element} elemento' : ''} · {cancel} volver`;
    get('.flyout-hint').toggleAttribute('hidden', detailsLearned);
    return { aiming, eligible, cure };
  }
  function renderScreen() {
    if (!state) return;
    ensurePlates();
    const ended = !busy && ['won', 'lost', 'escaped'].includes(state.phase);
    root.dataset.phase = state.phase;
    const fear = FEAR_KICKERS[state.encounter as keyof typeof FEAR_KICKERS];
    get('.battle-heading .battle-kicker').textContent = fear ? `ENCUENTRO / ${fear}`
      : state.encounter === 'palace-minion' ? 'ENCUENTRO / ESBIRRO DE LA REINA'
      : state.encounter === 'palace-guards' ? `ENCUENTRO / ${state.foes.filter(f => shownHp(f) > 0).length} DE ${state.foes.length} ${state.foes.length === 1 ? 'GUARDIÁN' : 'GUARDIANES'} DE CHICLE`
      : state.encounter === 'night-guard' ? state.foes.some(f => isCastle(f.kind)) ? 'ENCUENTRO / ALUMNOS DE LA REINA EN LA MERIDIANA' : 'ENCUENTRO / UN GUARDIÁN DE CHICLE EN LA MERIDIANA'
      : state.encounter.startsWith('crias-') ? `ENCUENTRO / ${state.foes.filter(f => shownHp(f) > 0).length} DE ${state.foes.length} CRÍAS DEL MIEDO`
      : `ENCUENTRO / ${state.foes.filter(f => shownHp(f) > 0).length} DE ${state.foes.length} PERROS${state.possessed ? ' POSEÍDOS' : ''}`;
    get('.round-badge strong').textContent = String(state.round).padStart(2, '0');
    // The artilugio's stand-in keys, shown the moment they can do something and until the first note
    // sounds, unless the real one is in Gerard's hands.
    get('.battle-notes').hidden = !artilugioLive(state) || !!state.castle?.startled || !!callbacks.board?.();
    // Cards are kept (and moved between docks) so the waves glide instead of snapping.
    const roster = get('.party-roster');
    if (!root.querySelector('.party-card')) roster.innerHTML = state.allies.map(c => `<article class="party-card" data-unit="${c.id}" data-anima="${c.classId ?? 'none'}">${plate(c)}<span class="unit-boost" hidden></span><span class="unit-status"></span><button class="roster-target" type="button" data-target="${c.id}" aria-label="Elegir a ${c.name}" hidden></button></article>`).join('');
    const isSplit = split();
    root.toggleAttribute('data-split', isSplit);
    get('.dev-badge').hidden = isSplit || !callbacks.solo() || !state.allies.some(a => a.id === 'aitor');
    get('.battle-dock[data-dock="2"]').hidden = !isSplit;
    // Whoever the Queen holds has crossed to her side (docs/castle-bosses.md § Aitor, held): their card
    // stands there, over the commands player 2 plays her turn with, and their dock is empty.
    const hers = state.allies.filter(a => a.castle?.held === 'reina');
    get('.held-side').hidden = !hers.length;
    for (const dock of root.querySelectorAll<HTMLElement>('.battle-dock')) {
      const owner = ownerOf(dock);
      if (owner && hers.includes(owner)) dock.hidden = true;
      if (!owner || dock.hidden) continue;
      // Split, each dock is its player's whenever their fighter can choose, whoever else is acting.
      const mine = isSplit ? canAct(owner) : state.phase === 'player' && state.allies[state.active] === owner && !busy;
      const menu = isSplit ? menus[callbacks.driver(owner.id)] : { targeting };
      dock.dataset.anima = owner.classId ?? 'none'; dock.dataset.member = owner.id;
      dock.classList.toggle('is-turn', mine);
      const wait = dock.querySelector<HTMLElement>('.dock-wait')!;
      const queueing = showQueue(dock, owner);
      const own = dock.querySelector<HTMLElement>('.command-panel')!;
      own.hidden = isSplit ? !mine : dock.dataset.dock !== '1';
      const job = pending.find(j => j.ally === owner.id);
      wait.hidden = (isSplit ? mine : dock.dataset.dock === '1') || queueing;
      wait.textContent = job ? `Listo: ${job.text}` : owner.hp === 0 ? 'Fuera de combate' : state.phase !== 'player' ? 'En acción…' : state.spent?.includes(owner.id) ? 'Ya ha actuado' : busy ? 'En acción…' : `Turno de ${state.allies[state.active].name}`;
      const switcher = dock.querySelector<HTMLElement>('.anima-switch')!;
      // Bernat wears no ánima: his dock has no pills.
      switcher.hidden = !wearsAnimas(owner) || !kitIn(state, owner).length || owner.hp === 0;
      const chips = switcher.querySelector('.anima-chips')!;
      const signature = `${owner.id}:${owner.profile}:${kitIn(state, owner).join(',')}`;
      if (chips.getAttribute('data-for') !== signature) {
        chips.setAttribute('data-for', signature);
        // Only the ánimas this fighter can wear (Matemágico is Gerard's, Tecnópata Aitor's).
        chips.innerHTML = kitIn(state, owner).map(id => `<button type="button" tabindex="-1" data-anima="${id}" style="--chip:${CLASSES[id].colour}"><span class="chip-label">${animaOf(id, grownUp(owner.profile)).name}</span><span class="chip-mana" aria-hidden="true"></span></button>`).join('');
      }
      const off = !mine || menu.targeting || callbacks.waiting(owner.id);
      switcher.toggleAttribute('data-off', off);
      switcher.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
        const id = button.dataset.anima as ClassId | undefined;
        if (id) button.setAttribute('aria-pressed', String(owner.classId === id));
        // One someone else has on is theirs until they take it off.
        const taken = !!id && state!.allies.some(a => a !== owner && a.classId === id);
        button.toggleAttribute('data-taken', taken);
        button.disabled = off || taken;
        if (id) chipMana(button, owner, id);
      });
    }
    for (const c of state.allies) {
      const card = root.querySelector<HTMLElement>(`.party-card[data-unit="${c.id}"]`)!;
      // Alone, the fighter whose turn it is stands in the dock; split, each in their player's dock.
      const home = hers.includes(c) ? get('.held-card') : isSplit || (state.allies[state.active] === c) ? dockOf(c.id).querySelector('.dock-plate')! : roster;
      if (card.parentElement !== home) home.append(card);
      if (card.dataset.anima !== (c.classId ?? 'none')) dress(card, c);
      const choosing = isSplit ? canAct(c) : state.phase === 'player' && state.allies[state.active].id === c.id;
      card.classList.toggle('is-active', choosing);
      card.classList.toggle('is-down', shownHp(c) === 0);
      card.classList.toggle('is-acting', root.dataset.actor === c.id);
      const boost = card.querySelector<HTMLElement>('.unit-boost')!;
      boost.hidden = !boostRounds(state) || c.hp === 0;
      boost.textContent = `▲ ${boostRounds(state)}`;
      boost.title = SKILLS.filter(skill => boostRounds(state!, skill.id)).map(skill => `${skill.name}: ${boostedStats(skill.id)} +${state!.boosts![skill.id]!.amount}`).join(' · ');
      card.querySelector('.unit-status')!.textContent = c.hp === 0 ? 'FUERA' : c.guarding ? 'EN GUARDIA' : choosing ? 'ACTIVO' : '';
      setVitals(card.querySelector('.vitals')!, shownHp(c), c.maxHp, c.secondary, animaMax(c), c.classId === DICED ? diceOf(state, c) : undefined);
      const plate = root.querySelector(`.battle-target[data-target="${c.id}"]`);
      plate?.toggleAttribute('data-hers', hers.includes(c));
      card.toggleAttribute('data-hers', hers.includes(c));
      if (plate) fill(plate.querySelector('.enemy-health')!, shownHp(c) / c.maxHp);
      const platePips = plate?.querySelector<HTMLElement>('.plate-pips');
      if (platePips && platePips.childElementCount !== c.maxSecondary) platePips.innerHTML = '<i data-pip="full"></i>'.repeat(c.maxSecondary);
      platePips?.toggleAttribute('hidden', !animaMax(c));
      platePips?.toggleAttribute('data-dice', c.classId === DICED);
      plate?.querySelectorAll<HTMLElement>('.plate-pips i').forEach((pip, i) => { pip.dataset.pip = i < c.secondary ? 'full' : 'spent'; });
      if (plate && (!unlanded || released.has(c.id))) showStatuses(plate, c);
    }
    const order = state.allies.map(c => root.querySelector(`.party-card[data-unit="${c.id}"]`)!).filter(card => card.parentElement === roster);
    if (order.some((card, i) => roster.children[i] !== card)) order.forEach(card => roster.append(card));
    for (const foe of state.foes) {
      const plate = get<HTMLButtonElement>(`.battle-target[data-target="${foe.id}"]`);
      fill(plate.querySelector('.enemy-health')!, shownHp(foe) / foe.maxHp);
      if (!unlanded || released.has(foe.id)) showStatuses(plate, foe);
      const health = foe.hp === 0 ? 'fuera de combate' : foe.hp === foe.maxHp ? 'salud completa' : foe.hp / foe.maxHp <= .3 ? 'salud baja' : 'herido';
      plate.setAttribute('aria-label', `Elegir a ${foe.name}, ${health}`);
      plate.classList.toggle('is-down', shownHp(foe) === 0);
      plate.classList.toggle('is-acting', root.dataset.actor === foe.id);
    }
    // She is down on her stage: the last scene plays in the fight instead of its victory screen.
    if (ended && state.phase === 'won' && (state.encounter === 'reina' || state.encounter === 'reina-vuelta') && callbacks.lastScene && !finale) { finale = true; void playLast(); }
    get('.battle-bottom').hidden = ended;
    get('.battle-result').hidden = !ended || finale;
    if (ended && !finale) {
      get('.battle-result h2').textContent = state.phase === 'won' ? '¡Camino libre!' : state.phase === 'escaped' ? 'Seguimos.' : state.encounter === 'palace-guards' || state.encounter === 'night-guard' ? 'Demasiado fuertes.' : 'Un respiro.';
      // A fall can be fought again or stepped back from, except in chapter 2's castle, where it wakes Gerard up at home.
      const again = state.phase === 'lost' && !!callbacks.forgiving?.();
      const leave = get<HTMLButtonElement>('.battle-result [data-after="close"]');
      leave.hidden = again;
      leave.textContent = state.phase === 'lost' && state.encounter !== 'dogs' ? 'Despertar' : state.encounter === 'dogs' ? 'Volver a la calle' : 'Seguir';
      get('.battle-result [data-after="retry"]').hidden = !again;
      get('.battle-result [data-after="rewind"]').hidden = !again;
      get('.battle-result p').textContent = state.message;
      if (!rewarded) { rewarded = true; showRewards(); }
      get<HTMLButtonElement>(`.battle-result [data-after="${again ? 'retry' : 'close'}"]`).focus({ preventScroll: true });
    }
  }
  /**
   * The victory screen (src/levels.ts): what the fight was worth, and a card for each ánima that took
   * part, with who wore it. Its EXP bar fills from where it was; a level reached flashes on the card
   * with what it learned. The story keeps the same numbers when the screen closes (`award`).
   * A level reached holds the screen (`data-holding`) until it has all shown (`settleRewards`).
   */
  function showRewards() {
    const list = get('.result-animas'), total = get('.result-xp'), result = get('.battle-result');
    resetRewards();
    const token = rewardToken;
    const won = state?.phase === 'won', who = won ? participants(state!) : [], gained = won ? fightXp(state!) : 0;
    const growth = won ? award(who.map(p => p.id), gained, xpBefore, state!.levels ?? {}, levelCap) : [];
    result.toggleAttribute('data-rewards', !!growth.length);
    total.hidden = !won || !gained;
    total.querySelector('strong')!.textContent = `+${gained} EXP`;
    list.hidden = !growth.length;
    if (!growth.length || !state) { list.replaceChildren(); return; }
    const names = (ids: string[]) => ids.map(id => state!.allies.find(a => a.id === id)?.name ?? id).join(' · ');
    list.innerHTML = growth.map((g, i) => {
      const wearers = who.find(p => p.id === g.id)!.wearers, grown = wearers.some(id => grownUp(state!.allies.find(a => a.id === id)!.profile));
      return `<li class="xp-card" data-anima="${g.id}" style="--chip:${CLASSES[g.id].colour};--i:${i};--fill:${levelProgress(g.xpBefore, g.reach)}">
        <div class="xp-head"><strong>${animaOf(g.id, grown).name}</strong><small>${names(wearers)}</small></div>
        <div class="xp-row"><span class="xp-level">NIVEL <b>${g.levelBefore}</b></span><span class="xp-count">${g.levelBefore >= topOf(g.id) ? 'MÁXIMO' : `+${g.xpAfter - g.xpBefore} EXP`}</span></div>
        <div class="xp-bar" aria-hidden="true"><i></i></div>
        <span class="xp-stamp" aria-hidden="true" hidden></span>
        <p class="xp-learn" hidden></p></li>`;
    }).join('');
    // Each bar fills after its card has come in; with reduced motion they are simply where they end.
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches, start = performance.now();
    const cards = [...list.querySelectorAll<HTMLElement>('.xp-card')];
    const shown = growth.map(g => g.levelBefore);
    result.toggleAttribute('data-holding', growth.some(g => g.levelAfter > g.levelBefore));
    filling = true;
    const step = (now: number) => {
      if (token !== rewardToken) return;
      let running = false;
      growth.forEach((g, i) => {
        const t = still ? 1 : Math.max(0, Math.min(1, (now - start - 700 - i * 160) / 1300));
        if (t < 1) running = true;
        const eased = 1 - (1 - t) ** 3, xp = g.xpBefore + (g.xpAfter - g.xpBefore) * eased;
        const level = Math.max(g.levelBefore, Math.min(g.levelAfter, levelForXp(xp, g.reach)));
        cards[i].style.setProperty('--fill', String(levelProgress(xp, g.reach)));
        if (level > shown[i]) { shown[i] = level; levelUp(cards[i], g, level, token); }
      });
      if (running) rewardFrame = requestAnimationFrame(step);
      else { filling = false; settleRewards(token); }
    };
    rewardFrame = requestAnimationFrame(step);
  }
  /**
   * The victory screen's hold: with a level reached, its way out stays dim and deaf (`data-holding`)
   * until every bar has filled, every skill learned has had the screen (`nextReveal`) and LEVEL_HOLD
   * has passed, so a quick press never skips it. Then it lights up (`data-released`).
   */
  const LEVEL_HOLD = 900;
  /** What a level taught: skills (with their maná), or a passive that comes with the level (no cost: `passive`). */
  interface Reveal { skills: { name: string; description: string; cost?: number }[]; anima: string; who: string; level: number; colour: string; id: ClassId; passive?: true }
  let rewardToken = 0, filling = false, revealing = false, reveals: Reveal[] = [];
  let rewardTimer: ReturnType<typeof setTimeout> | undefined, revealTimer: ReturnType<typeof setTimeout> | undefined;
  const holdingRewards = () => get('.battle-result').hasAttribute('data-holding');
  /** Whatever the last victory screen had going stops: a new one, or the fight closing. */
  function resetRewards() {
    rewardToken++; cancelAnimationFrame(rewardFrame); clearTimeout(rewardTimer); clearTimeout(revealTimer);
    if (revealing) holdOn?.done();
    filling = false; revealing = false; reveals = [];
    const result = get('.battle-result'), band = get('.skill-reveal');
    result.removeAttribute('data-holding'); delete result.dataset.released; delete result.dataset.revealing;
    band.hidden = true; delete band.dataset.leaving;
  }
  function settleRewards(token: number) {
    if (token !== rewardToken || filling || revealing || !holdingRewards()) return;
    clearTimeout(rewardTimer);
    rewardTimer = setTimeout(() => {
      if (token !== rewardToken) return;
      const result = get('.battle-result');
      result.removeAttribute('data-holding'); result.dataset.released = '';
      result.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus({ preventScroll: true });
    }, LEVEL_HOLD);
  }
  /** What each level taught takes the screen, one ánima after another, each until a player confirms (`revealSkill`). */
  function nextReveal(token: number) {
    if (token !== rewardToken) return;
    const band = get('.skill-reveal'), result = get('.battle-result'), next = reveals.shift();
    if (!next) { revealing = false; delete result.dataset.revealing; settleRewards(token); return; }
    revealing = true; result.dataset.revealing = '';
    revealSkill(band, next);
    // It stays until a player confirms (`holdUntilConfirm`), then the next one comes.
    void holdUntilConfirm().then(() => {
      if (token !== rewardToken) return;
      band.dataset.leaving = '';
      revealTimer = setTimeout(() => { if (token !== rewardToken) return; band.hidden = true; delete band.dataset.leaving; nextReveal(token); }, 320);
    });
  }
  /**
   * What a level taught has the screen for a moment: a band across it in its ánima's colour,
   * «HABILIDAD NUEVA» (or «HABILIDADES NUEVAS»), who learned it at which level, and each skill's name
   * landing with a glint, one after the other, with what it does and its maná; rays turn behind it and
   * it has its own sound (`skill-learned`). The card keeps «Aprende …» after it.
   */
  function revealSkill(band: HTMLElement, { skills, anima, who, level, colour, id, passive }: Reveal) {
    band.dataset.anima = id; band.dataset.count = String(skills.length); band.style.setProperty('--chip', colour);
    band.querySelector('.battle-kicker')!.textContent = passive ? 'PASIVA NUEVA' : skills.length > 1 ? 'HABILIDADES NUEVAS' : 'HABILIDAD NUEVA';
    band.querySelector('.skill-reveal-who')!.textContent = [anima, `nivel ${level}`, who].filter(Boolean).join(' · ');
    band.querySelector('.skill-reveal-skills')!.innerHTML = skills.map((skill, i) => `<div class="skill-reveal-skill" style="--k:${i}"><h2>${escapeHtml(skill.name)}</h2><p>${escapeHtml(skill.description)}</p><strong class="skill-reveal-cost">${skill.cost === undefined ? 'SIEMPRE ACTIVA' : `MANÁ ${costPips(skill.cost)}`}</strong></div>`).join('');
    delete band.dataset.leaving; band.hidden = true; void band.offsetWidth; band.hidden = false;
    callbacks.sound('skill-learned');
  }
  /** A card reaches `level`: its number stamps in, the card flashes in its colour and says what it learned, and each skill new at that level takes the screen. */
  function levelUp(card: HTMLElement, g: Growth, level: number, token: number) {
    callbacks.sound('level-up');
    card.querySelector('.xp-level b')!.textContent = String(level);
    const stamp = card.querySelector<HTMLElement>('.xp-stamp')!;
    stamp.textContent = `¡NIVEL ${level}!`; stamp.hidden = false;
    card.removeAttribute('data-up'); void card.offsetWidth; card.setAttribute('data-up', '');
    flashAnima(card, CLASSES[g.id].colour);
    if (level >= topOf(g.id)) card.querySelector('.xp-count')!.textContent = 'MÁXIMO';
    const learned = SKILLS.filter(skill => g.learned.includes(skill.id) && 'level' in skill && skill.level <= level);
    // A passive that comes with a level (Colorista's Remolino): learned as a skill is, with nothing to pay.
    const gifts = (g.passives ?? []).filter(id => (PASSIVES[id].level ?? 0) <= level);
    // Level 4 of an ánima that grows by level is a point of maná: the card says so too.
    const mana = g.levelBefore < MANA_LEVEL && level >= MANA_LEVEL;
    if (!learned.length && !gifts.length && !mana) return;
    const line = card.querySelector<HTMLElement>('.xp-learn')!, names = [...learned.map(skill => skill.name), ...gifts.map(id => PASSIVES[id].name)];
    line.innerHTML = names.length ? 'Aprende <strong></strong>' : 'Gana <strong></strong>';
    line.querySelector('strong')!.textContent = [names.join(' y '), ...mana ? ['Maná +1'] : []].filter(Boolean).join(' · ');
    line.hidden = false;
    const anima = card.querySelector('.xp-head strong')?.textContent ?? '', who = card.querySelector('.xp-head small')?.textContent ?? '';
    const fresh = learned.filter(skill => 'level' in skill && skill.level === level);
    if (fresh.length) reveals.push({ skills: fresh, anima, who, level, colour: CLASSES[g.id].colour, id: g.id });
    const given = gifts.filter(id => PASSIVES[id].level === level);
    if (given.length) reveals.push({ skills: given.map(id => ({ name: PASSIVES[id].name, description: PASSIVES[id].description ?? '' })), anima, who, level, colour: CLASSES[g.id].colour, id: g.id, passive: true });
    if (!revealing) nextReveal(token);
  }
  function collapse(restoreFocus = false) {
    const old = selected; selected = undefined; selectedSkill = undefined; selectedDual = undefined; pickingDie = undefined; selectedDie = undefined; targeting = false;
    callbacks.aimDie?.();
    highlight(); delete root.dataset.targeting;
    root.querySelectorAll<HTMLButtonElement>('[data-target]').forEach(button => {
      button.disabled = true;
      button.closest('[data-unit]')?.classList.remove('is-eligible');
    });
    get('.command-deck').hidden = false; get('.target-picker').hidden = true;
    root.querySelectorAll<HTMLElement>('.roster-target').forEach(button => { button.hidden = true; button.closest('[data-unit]')?.classList.remove('is-eligible'); });
    articles().forEach(article => article.classList.remove('expanded'));
    root.querySelectorAll('[data-command="skill"] .command-trigger, [data-command="dual"] .command-trigger').forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
    delete panelEl().dataset.flyout; delete panelEl().dataset.sheet; get('.skill-flyout').inert = true;
    showDetails(false);
    if (restoreFocus && old) focusOn(get<HTMLButtonElement>(`[data-command="${old}"] .command-trigger`));
  }
  /** Who the target picker is on, by name under its line: three of a kind stand close (Dirección), and a plate alone does not say who is who. */
  function aimName(id?: string) {
    const box = get<HTMLElement>('.target-picker .target-name'), who = id && state && [...state.foes, ...state.allies].find(c => c.id === id);
    // A dual on every foe or the whole party says so (a skill with no target too): the plate under the cursor is only where the confirm is pressed.
    const whole = targeting ? wholeSide() : undefined;
    box.hidden = !who; box.textContent = who ? whole ?? who.name : '';
    // The picker wears the colour of whoever is aiming, the same as their ring and the plate they are on.
    get<HTMLElement>('.target-picker').dataset.aim = String(aimSlot());
  }
  /**
   * Whom each player is aiming at, each in their colour: Gerard's gold (`.is-targeted`), Aitor's cyan
   * (`.is-targeted-2`), on the plate or the card and in the ring on the floor. Split it is whoever's
   * menu this is; alone, whose turn it is (Aitor's choices are cyan too), and only one aims at a time.
   */
  const aimedBy: Partial<Record<PlayerId, string>> = {};
  const aimSlot = (): PlayerId => !state ? 1 : split() ? ctx : state.allies[state.active]?.id === 'aitor' ? 2 : 1;
  /** The fighter choosing each aim (split, the player's own; alone, whose turn it is): in the fight they turn towards it. */
  const aimers: Partial<Record<PlayerId, string>> = {};
  function highlight(id?: string) {
    const slot = aimSlot();
    aimedBy[slot] = id;
    aimers[slot] = !state ? undefined : split() ? allyOf(slot)?.id : state.allies[state.active]?.id;
    if (!state || !split()) aimedBy[slot === 1 ? 2 : 1] = undefined;
    ([1, 2] as PlayerId[]).forEach(p => callbacks.target(aimedBy[p], p, aimers[p]));
    aimName(id); showAims();
  }
  function showAims() {
    const on = (el: HTMLElement, id?: string) => !!id && (el.dataset.unit === id || el.dataset.target === id);
    root.querySelectorAll<HTMLElement>('[data-unit], [data-target]').forEach(el => {
      el.classList.toggle('is-targeted', on(el, aimedBy[1]));
      el.classList.toggle('is-targeted-2', on(el, aimedBy[2]));
    });
  }
  /**
   * Getting a move ready ahead (docs/combat.md § Ataques duales): with two players, the fighter
   * after the one choosing can pick theirs in their own dock, with their own device, while they
   * wait (Atacar, Habilidad or Defender; never Huir, never another ánima). It plays on its own
   * when their turn comes; if the other one's skill and theirs make a dual, it happens instead,
   * by surprise. Nothing on screen says which choices would.
   */
  interface QueueMenu { ally: string; level: 'root' | 'skill' | 'target'; action?: Queued['action']; skill?: SkillId; cursor: number }
  let queueMenu: QueueMenu | undefined;
  /** A queued choice that is going off now (its plate flashes), and one that could not (`stale`: choose again). */
  let firing: { id: string; text: string } | undefined;
  let stale: string | undefined;
  /** Who can get a move ready now: the next fighter in the round, played by the other player. */
  function queueOwner() {
    // Two players now choose at once (`withPlayer`): nothing waits in a queue any more.
    return undefined as Combatant | undefined;
  }
  /** «Zarpazos → Vertitrón», «Ronroneo de Yuki → Todo el equipo», «Defender». */
  function queuedText(q: Queued, owner: Combatant) {
    const spec = SKILLS.find(x => x.id === q.skill);
    const name = q.action === 'attack' ? attackName(owner) : q.action === 'defend' ? 'Defender' : spec?.name ?? '';
    if (q.action === 'defend') return name;
    const target = q.target && [...state!.allies, ...state!.foes].find(c => c.id === q.target)?.name;
    return `${name} → ${target ?? (spec?.side === 'all-foes' ? 'Todos los enemigos' : 'Todo el equipo')}`;
  }
  function queueItems(owner: Combatant): { id: string; label: string; detail?: string; off?: boolean }[] {
    const s = state!, m = queueMenu!;
    if (m.level === 'root') return [{ id: 'attack', label: attackName(owner) }, { id: 'skill', label: 'Habilidad', off: !skillsFor(s, owner).length }, { id: 'defend', label: 'Defender' }];
    if (m.level === 'skill') return skillsFor(s, owner).filter(skill => !('free' in skill)).map(skill => {
      const affordable = owner.secondary >= skill.cost, available = validTargets(s, 'skill', skill.id).length > 0;
      return { id: skill.id, label: skill.name, detail: !affordable ? 'Sin maná' : available ? costPips(skill.cost) : skill.kind === 'boost' ? 'En marcha' : 'Sin objetivo', off: !affordable || !available };
    });
    return (m.action === 'attack' ? validTargets(s, 'attack') : validTargets(s, 'skill', m.skill)).map(c => ({ id: c.id, label: escapeHtml(c.name) }));
  }
  /** The partner's corner of their dock: the menu to get a move ready, or the move ready. Returns whether it shows anything. */
  function showQueue(dock: HTMLElement, owner: Combatant) {
    const s = state!, queued = s.queued?.[owner.id], fire = firing?.id === owner.id ? firing : undefined;
    const plateEl = dock.querySelector<HTMLElement>('.queue-plate')!, menuEl = dock.querySelector<HTMLElement>('.queue-panel')!, note = dock.querySelector<HTMLElement>('.queue-note')!;
    const text = fire?.text ?? (queued ? queuedText(queued, owner) : '');
    plateEl.hidden = !text;
    plateEl.querySelector('strong')!.textContent = text;
    plateEl.toggleAttribute('data-firing', !!fire);
    plateEl.querySelector<HTMLElement>('.queue-cancel')!.hidden = !!fire || !queued || unqueueLearned;
    dock.toggleAttribute('data-queued', !!text);
    const open = !text && queueOwner() === owner;
    if (open && queueMenu?.ally !== owner.id) queueMenu = { ally: owner.id, level: 'root', cursor: 0 };
    menuEl.hidden = !open;
    if (open) {
      const m = queueMenu!, items = queueItems(owner);
      m.cursor = Math.max(0, Math.min(m.cursor, items.length - 1));
      menuEl.querySelector('.battle-kicker')!.textContent = `LUEGO · ${owner.name.toUpperCase()}${m.level === 'skill' ? ' · HABILIDAD' : m.level === 'target' ? ' · ¿A QUIÉN?' : ''}`;
      const html = items.map((item, i) => `<button type="button" tabindex="-1" data-queue="${i}"${item.off ? ' aria-disabled="true"' : ''}${i === m.cursor ? ' class="is-cursor"' : ''}><strong>${item.label}</strong>${item.detail ? `<small>${item.detail}</small>` : ''}</button>`).join('') || '<p class="skill-empty">Nada que preparar.</p>';
      const list = menuEl.querySelector<HTMLElement>('.queue-list')!;
      if (list.dataset.for !== html) { list.dataset.for = html; list.innerHTML = html; }
      menuEl.querySelector<HTMLElement>('.queue-hint')!.hidden = queueLearned;
    }
    note.hidden = stale !== owner.id || s.phase !== 'player' || s.allies[s.active] !== owner;
    return !plateEl.hidden || open;
  }
  function prepare(owner: Combatant, choice: Queued) {
    if (!state || !queue(state, owner.id, choice)) { callbacks.sound('denied'); return; }
    queueLearned = true; queueMenu = undefined;
    callbacks.sound('ui-confirm'); render();
  }
  /** Takes a move ready back; while the other one's move is still playing it can be, until it goes off. */
  function unqueue(owner: Combatant, reopen = false) {
    if (!state) return;
    if (!queue(state, owner.id, null) && state.queued) delete state.queued[owner.id];
    if (!reopen) unqueueLearned = true;
    queueMenu = undefined;
    callbacks.sound('ui-back'); render();
  }
  function queuePick(owner: Combatant) {
    const m = queueMenu, item = m && queueItems(owner)[m.cursor];
    if (!m || !item || item.off) { callbacks.sound('denied'); return; }
    if (m.level === 'root' && item.id === 'defend') return prepare(owner, { action: 'defend' });
    if (m.level === 'root') Object.assign(m, item.id === 'attack' ? { level: 'target', action: 'attack', cursor: 0 } : { level: 'skill', action: 'skill', cursor: 0 });
    else if (m.level === 'skill' && !aimed(item.id as SkillId)) return prepare(owner, { action: 'skill', skill: item.id as SkillId });
    else if (m.level === 'skill') Object.assign(m, { level: 'target', skill: item.id as SkillId, cursor: 0 });
    else return prepare(owner, { action: m.action!, ...m.skill ? { skill: m.skill } : {}, target: item.id });
    callbacks.sound('ui-confirm'); render();
  }
  /**
   * 'queue' while Escape belongs to player 1's move ready ahead (keyboard): one is ready to take
   * back, or its menu is past the first level. Off their turn (or while a move plays) only.
   */
  function queueContext() {
    if (!state || !['player', 'enemy'].includes(state.phase) || (turnDriver() === 1 && !busy)) return '';
    const mine = state.allies.find(a => callbacks.driver(a.id) === 1 && (state!.queued?.[a.id] || (queueOwner() === a && queueMenu?.ally === a.id && queueMenu.level !== 'root')));
    return mine ? 'queue' : '';
  }
  /** Development (the Dual command): why a dual cannot happen now, in words. */
  function dualReason(option: ReturnType<typeof dualOptions>[number]) {
    const s = state!, { dual, holder, partner, reason } = option;
    const skillOf = (id: SkillId) => SKILLS.find(x => x.id === id)!;
    const [a, b] = dual.parts.map(id => skillOf(id).class);
    const reasons: Record<DualBlock, () => string> = {
      level: () => { const missing = dual.parts.map(skillOf).find(x => (s.levels?.[x.class] ?? 1) < ('level' in x ? x.level : 1)); return missing ? `Falta ${missing.name} (nivel ${'level' in missing ? missing.level : 1})` : 'Falta nivel'; },
      used: () => 'Ya usado en este combate',
      acted: () => partner ? `${partner.name} ya ha actuado` : 'Sin compañero',
      down: () => `${partner?.name ?? 'Tu compañero'} no puede luchar`,
      target: () => 'Sin objetivo',
      wear: () => {
        const mine = option.wear ?? holder.classId;
        if (partner && (mine === a || mine === b)) return `${partner.name} no lleva ${CLASSES[mine === a ? b : a].name}`;
        if (partner?.classId === a || partner?.classId === b) return `${holder.name} no lleva ${CLASSES[partner.classId === a ? b : a].name}`;
        return `Nadie lleva ${CLASSES[a].name} ni ${CLASSES[b].name}`;
      },
      mana: () => { const short = dual.parts.map(skillOf).map(x => ({ who: wearerOf(option, x.class), cost: x.cost })).find(({ who, cost }) => who && manaIn(who, option) < cost); return short?.who ? `Sin maná · ${short.who.name}` : 'Sin maná'; },
    };
    return reason ? reasons[reason]() : '';
  }
  /** Who would bring the half of ánima `id` (the one choosing, after putting it on if they would). */
  const wearerOf = (option: ReturnType<typeof dualOptions>[number], id: ClassId) => option.partner?.classId === id ? option.partner : (option.wear ?? option.holder.classId) === id ? option.holder : undefined;
  const manaIn = (c: Combatant, option: ReturnType<typeof dualOptions>[number]) => c === option.holder && option.wear ? c.mana?.[option.wear] ?? manaMax(state?.improved, option.wear, state?.levels) : c.secondary;
  /** A dual's halves, Matemágico's first (the banner's left, its navy half). */
  const halves = (dual: DualSpec) => [...dual.parts].map(id => SKILLS.find(x => x.id === id)!).sort((x, y) => Number(y.class === 'matemagico') - Number(x.class === 'matemagico'));
  /** The combined cost: one group of circles per half, each in its ánima's colour, under whoever pays it. */
  function dualPips(dual: DualSpec, who: (id: ClassId) => string) {
    const cost = dualCost(dual);
    return `<span class="dual-pips">${halves(dual).map(x => `<span class="dual-pip-group" style="--chip:${CLASSES[x.class].colour}"><small>${escapeHtml(who(x.class))}</small><span>${'<i></i>'.repeat(cost[x.id] ?? 0)}</span></span>`).join('<b>+</b>')}</span>`;
  }
  const dualTotal = (dual: DualSpec) => {
    const pair = halves(dual);
    return pair.some(skill => skill.class === DICED)
      ? pair.map(skill => `${skill.cost} ${skill.class === DICED ? (skill.cost === 1 ? 'dado' : 'dados') : 'maná'}`).join(' + ')
      : `${pair.map(skill => skill.cost).join(' + ')} maná`;
  };
  /** Development: the Dual command's sheet, every dual with what it costs, or why it cannot be now. */
  function fillDuals() {
    if (!state) return;
    const options = dualOptions(state, true), first = options[0];
    get('.skill-flyout .battle-kicker').textContent = `DUALES · ${[first?.holder, first?.partner].filter(Boolean).map(c => c!.name.toUpperCase()).join(' + ')}`;
    get('.skill-list').innerHTML = options.map((option, i) => {
      const parts = halves(option.dual).map(x => x.name).join(' + ');
      const cost = option.ok ? dualPips(option.dual, id => wearerOf(option, id)?.name ?? '') : escapeHtml(dualReason(option));
      return `<button type="button" data-dual="${option.dual.id}" ${option.ok ? '' : 'aria-disabled="true"'} style="--i:${i}"><span class="skill-key">${i + 1}</span><span class="skill-name"><strong>${escapeHtml(option.dual.name)}</strong><small>${escapeHtml(parts)}</small></span><small class="skill-cost">${cost}</small></button>`;
    }).join('');
    fitSkills();
  }
  /** Development: a dual picked from the sheet; the one choosing puts on the ánima of their half first if it is free in their kit. */
  function chooseDual(id: DualId) {
    if (!state || locked()) return;
    const option = dualOptions(state, true).find(o => o.dual.id === id);
    if (!option?.ok) { callbacks.sound('denied'); return; }
    if (option.wear) changeAnima(option.wear);
    selectedDual = id;
    beginTargeting();
  }
  /**
   * A dual attack's banner (docs/combat.md § Ataques duales), the only place its cost and words show
   * in the game: top centre, a card split in Matemágico's navy blueprint and Papagato's cream paper,
   * each half with whoever brought it and what it cost them. It comes up as the dual is aimed
   * (`armDualBanner`) and goes off on the confirm (`showDualBanner`): while it holds then, the fight
   * (3D and clock) runs slow and goes cinematic (`.dual-cinema`). Shorter once that dual has been seen.
   */
  let bannerTimer: ReturnType<typeof setTimeout> | undefined, compactTimer: ReturnType<typeof setTimeout> | undefined;
  /** The banner's card for `spec`, each half under whoever brings it. */
  function fillDualBanner(spec: DualSpec, brought: (id: ClassId) => Combatant | undefined) {
    const banner = get('.dual-banner');
    banner.querySelector('.battle-kicker')!.textContent = spec.major ? 'DÚO MAYOR' : 'ATAQUE DUAL';
    if (spec.major) banner.dataset.major = 'true'; else delete banner.dataset.major;
    banner.querySelector('h2')!.textContent = spec.name;
    banner.querySelector('.dual-halves')!.innerHTML = halves(spec).map(x => `<div class="dual-half" data-anima="${x.class}" style="--chip:${CLASSES[x.class].colour}"><span class="battle-kicker">${escapeHtml(brought(x.class)?.name.toUpperCase() ?? '')}</span><strong>${escapeHtml(x.name)}</strong><span class="dual-pips"><span class="dual-pip-group"><span>${'<i></i>'.repeat(dualCost(spec)[x.id] ?? 0)}</span></span></span></div>`).join('');
    banner.querySelector('.dual-total')!.textContent = dualTotal(spec);
    banner.querySelector('footer p')!.textContent = spec.description;
    clearTimeout(bannerTimer); clearTimeout(compactTimer);
    for (const key of ['leaving', 'compact', 'armed', 'fire', 'reveal']) delete banner.dataset[key];
    const bars = get('.dual-cinema'); bars.hidden = true; delete bars.dataset.leaving; delete bars.dataset.reveal;
    banner.hidden = true; void banner.offsetWidth; banner.hidden = false;
    return banner;
  }
  /** The dual the target picker would set off now: the skill picked completing the partner's queued half, or (development) the Dual command's. */
  function aimedDual() {
    const s = state;
    if (!s || !targeting || s.phase !== 'player') return;
    if (duo) return DUALS.find(d => d.id === duo!.id);
    if (selected === 'dual') return DUALS.find(d => d.id === selectedDual);
    if (selected === 'skill' && selectedSkill && !split()) { const d = queuedDual(s, selectedSkill); return d && knownDual(d.id) ? d : undefined; }
  }
  /**
   * While a dual is being aimed, its banner is already up, whole, its two halves meeting in the middle
   * (`data-armed`). The skill list gave nothing away: the dual shows the moment its skill is picked.
   * Backing out, or the partner taking their half back, puts it away.
   */
  function armDualBanner() {
    const s = state, banner = get('.dual-banner');
    if (!s || (busy && !duo)) return;
    const spec = aimedDual(), up = !banner.hidden && !banner.dataset.leaving;
    if (!spec) { if (up && banner.dataset.armed) hideDualBanner(); return; }
    if (up && banner.dataset.armed === spec.id) return;
    const pair = split() ? s.allies.filter(a => callbacks.driver(a.id) === 1 || callbacks.driver(a.id) === 2) : [s.allies[s.active], dualPartner(s)];
    fillDualBanner(spec, id => pair.find(c => c?.classId === id)).dataset.armed = spec.id;
    callbacks.sound('dual-armed');
  }
  /** A dual goes off: its banner bursts where it stood aimed (or comes in now), the fight slows and black bars close in. */
  function showDualBanner(effect: BattleEffect) {
    const d = effect.dual!, spec = DUALS.find(x => x.id === d.id), s = state!;
    if (!spec) return Promise.resolve();
    const seen = seenDuals.has(d.id), seconds = seen ? DUAL_BANNER_SEEN : DUAL_BANNER;
    seenDuals.add(d.id);
    if (seen) repeatedDuals.add(effect);
    const brought = (id: ClassId) => { const i = d.parts.findIndex(part => SKILLS.find(x => x.id === part)?.class === id); return s.allies.find(a => a.id === d.actors[i]); };
    let banner = get('.dual-banner');
    const armed = !banner.hidden && !banner.dataset.leaving && banner.dataset.armed === d.id;
    if (armed) { clearTimeout(bannerTimer); clearTimeout(compactTimer); delete banner.dataset.armed; delete banner.dataset.reveal; } else banner = fillDualBanner(spec, brought);
    banner.dataset.fire = 'true';
    const bars = get('.dual-cinema'); delete bars.dataset.leaving;
    // Just unlocked, the bars are already closed: only the flare and the rays come again.
    if (bars.dataset.reveal) { delete bars.dataset.reveal; for (const el of bars.querySelectorAll<HTMLElement>('i, b')) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; } }
    else { bars.hidden = true; void bars.offsetWidth; bars.hidden = false; }
    // Then only its name stays, so the rest of the move (and whoever is on top of a tall foe) shows. Read while it was aimed, sooner.
    compactTimer = setTimeout(() => { banner.dataset.compact = 'true'; }, (seen || armed ? seconds : seconds + .6) * 1000);
    slowDown(seconds);
    // Both docks light up in their own ánima's colour.
    for (const id of d.actors) { const ally = s.allies.find(a => a.id === id); if (ally?.classId) flashAnima(dockOf(id), CLASSES[ally.classId].colour); }
    return wait(seconds * 1000);
  }
  /**
   * The first time a dual ever goes off (docs/combat.md § Ataques duales): nobody armed it, the two
   * players just chose its halves together. Time stops (the scene and the fight's clock) and the
   * banner comes in as «DÚO DESBLOQUEADO», with its name, who brought which half, the cost and what it
   * does, until a player confirms; then it goes off from there as an armed one does (`showDualBanner`).
   */
  function revealDual(effect: BattleEffect) {
    const d = effect.dual!, spec = DUALS.find(x => x.id === d.id), s = state!;
    if (!spec) return Promise.resolve();
    const brought = (id: ClassId) => { const i = d.parts.findIndex(part => SKILLS.find(x => x.id === part)?.class === id); return s.allies.find(a => a.id === d.actors[i]); };
    const banner = fillDualBanner(spec, brought);
    banner.querySelector('.battle-kicker')!.textContent = spec.major ? 'DÚO MAYOR DESBLOQUEADO' : 'DÚO DESBLOQUEADO';
    if (spec.major) banner.dataset.major = 'true'; else delete banner.dataset.major;
    banner.dataset.armed = d.id; banner.dataset.reveal = 'true';
    const bars = get('.dual-cinema'); bars.dataset.reveal = 'true'; bars.hidden = false;
    callbacks.sound('dual-armed');
    // Time stands still until either player confirms (`holdUntilConfirm`), then eases back.
    callbacks.slowmo?.(0, 3600);
    root.dataset.revealing = 'true';
    for (const id of d.actors) { const ally = s.allies.find(a => a.id === id); if (ally?.classId) flashAnima(dockOf(id), CLASSES[ally.classId].colour); }
    return holdUntilConfirm().finally(() => { callbacks.slowmo?.(0, 0); delete root.dataset.revealing; });
  }
  function hideDualBanner() {
    const banner = get('.dual-banner'), bars = get('.dual-cinema');
    if (banner.hidden) return;
    banner.dataset.leaving = 'true';
    if (!bars.hidden) bars.dataset.leaving = 'true';
    clearTimeout(bannerTimer); clearTimeout(compactTimer); bannerTimer = setTimeout(() => {
      banner.hidden = true; bars.hidden = true; delete bars.dataset.leaving;
      for (const key of ['leaving', 'compact', 'armed', 'fire', 'reveal']) delete banner.dataset[key];
      delete bars.dataset.reveal;
    }, 300);
  }
  /**
   * Vertitrón's moves, shouted by Uri from up on it, in a bubble over him (he plays it like a video
   * game): «¡Pisotón!», «¡Barrido!», «¡Grito liberador!», and the charge before «¡Rayo terrorífico!».
   */
  function shout(effect: BattleEffect) {
    const s = state;
    const kind = s?.foes.find(f => f.id === effect.actor)?.kind;
    if (!s || effect.kind !== 'enemy' || !effect.ability) return;
    // La Sobremesa's friends say their own move, each over themselves (a turn lost says nothing).
    if (isSobremesa(kind)) {
      if (effect.cancelled && effect.amount === undefined && !effect.telegraph) return;
      const text = effect.ability.id === 'escala' ? `«${NOTES[Math.max(0, (s.foes.find(f => f.id === effect.actor)?.note ?? 1) - 1)]}…»` : `¡${effect.telegraph?.name ?? effect.ability.name}!`;
      void speak({ speaker: effect.actor as keyof typeof SPEAKERS, text }, 1500, true);
      return;
    }
    if (kind !== 'vertigo') return;
    const text = effect.telegraph ? `¡Cargando ${effect.telegraph.name.toLowerCase()}!` : `¡${effect.ability.name}!`;
    void speak({ speaker: 'uri', text }, 1500, true);
  }
  /** The first time a fear shows a trick, someone in the party says it, in a bubble over their head. */
  let charges = 0;
  function remark(effect: BattleEffect) {
    const s = state;
    if (!s) return;
    const say = (key: string, who: string | undefined, text: string) => {
      if (!who || remarked.has(key) || !s.allies.some(a => a.id === who && a.hp > 0) || !(who in SPEAKERS)) return;
      remarked.add(key); void speak({ speaker: who as keyof typeof SPEAKERS, text }, 2300);
    };
    const named = effect.telegraph?.id === 'carrerilla' ? s.allies.find(a => a.id === effect.telegraph!.target) : undefined;
    if (named) say('carrerilla', s.allies.find(a => a !== named && a.hp > 0)?.id, `¡${named.name}, agárrate!`);
    if (effect.flipped) say('vuelta', 'gerard', `¡Le ha dado la vuelta! Ahora es ${DISHES[effect.flipped].name}.`);
    if (effect.transparent?.length) say('transparente', 'aitor', '¡Le paso la mano a través!');
    if (effect.kind === 'enemy' && s.foes.find(f => f.id === effect.actor)?.kind === 'plato' && s.foes.find(f => f.id === effect.actor)?.dish === 'sorpresa') say('sorpresa', 'gerard', '¿Y eso qué es? Así, uno a uno, no hay quien se lo coma.');
    if (effect.telegraph?.id === 'rayo' && ++charges === 2) say('rayo', s.allies[1]?.id, 'Ese ojo… si lo rompemos, a lo mejor deja de disparar.');
    if (effect.eye) say('ojo', 'aitor', '¡Se le ha apagado el ojo!');
    // The campsite: the first Bombona charged, El Campeón's Plan first set back and first fired.
    if (effect.telegraph?.id === 'bombona') say('bombona', s.allies.find(a => a.hp > 0)?.id, 'Huele a gas. Eso va a explotar.');
    if (effect.foiled) say('frustrado', s.allies.find(a => a.id !== effect.actor && a.hp > 0)?.id, 'Se le ha apagado un poco el pecho.');
    if (effect.ability?.id === 'rayo-total') say('rayo-total', s.allies.find(a => a.hp > 0)?.id, 'Eso era lo que tenía cargando en el pecho.');
    // Las cuerdas: the first Lazo, the glass cracking, the lance left in the floor, the breath before the Calderón and its break.
    if (effect.lazo) say('lazo', 'aitor', effect.lazo.back ? 'Lo ha vuelto a atar. Mientras ella siga en pie, vuelve.' : 'Lo ha dejado como nuevo.');
    if (effect.cracked) say('rajado', 'gerard', 'Se ha rajado. Ya no devuelve nada.');
    if (effect.stuck) say('clavado', s.allies.find(a => a.id !== effect.target && a.hp > 0)?.id ?? s.allies.find(a => a.hp > 0)?.id, 'Se le ha quedado la lanza clavada.');
    if (effect.telegraph?.id === 'calderon') say('aliento', 'gerard', 'Está cogiendo aire. Esto no va a ser una nota corta.');
    if (effect.cancelled === 'calderon' && effect.kind !== 'enemy') say('calderon-roto', 'aitor', 'Se ha quedado sin aire.');
  }
  /**
   * A foe of the campsite's maze beaten: before it comes apart it shouts its group's word
   * (docs/quests/universidad.md § Las palabras), over its head, while it shudders.
   */
  let lastWord: string | undefined;
  const wordSaid = new Set<string>();
  function lastWords(token: number, delay: number) {
    const s = state;
    if (!s || !lastWord) return;
    for (const foe of s.foes) {
      if (foe.hp > 0 || wordSaid.has(foe.id)) continue;
      wordSaid.add(foe.id);
      const who = (foe.kind && foe.kind in SPEAKERS ? foe.kind : 'mago') as keyof typeof SPEAKERS;
      setTimeout(() => { if (token === generation) void speak({ speaker: who, text: `¡${lastWord}!` }, 1700, true, foe.id); }, delay);
    }
  }
  /**
   * What a foe's move is called, and whose it is, for the callout up top (docs/combat.md § El nombre
   * de lo que hace el enemigo). The party's own is said under its numbers; news that is not a move (an
   * eye going out) has none.
   */
  function foeMoveOf(effect: BattleEffect): { who: Combatant; name: string; detail: string } | undefined {
    const s = state;
    if (!s || effect.kind !== 'enemy') return;
    const everyone = [...s.allies, ...s.foes], who = s.foes.find(c => c.id === effect.actor);
    if (!who) return;
    const named = (id?: string) => everyone.find(c => c.id === id)?.name ?? '';
    if (effect.iced) return { who, name: 'Congelado', detail: 'Pierde el turno' };
    if (effect.stunned) return { who, name: 'Shock', detail: 'Pierde el turno' };
    if (effect.confused) return { who, name: 'Confundido', detail: effect.target === who.id ? 'Se golpea a sí mismo' : `Golpea a ${named(effect.target)}` };
    if (effect.ability) {
      // A move announced for its next turn says what and at whom, as its plate's chip does: being got
      // ready (a turn with no blow), or coming after this one's blow. One that came to nothing loses the turn.
      const t = effect.telegraph, aim = t ? `→ ${t.target ? named(t.target) : t.at ?? ''}` : '';
      const blow = effect.amount !== undefined || !!effect.hits?.length;
      const detail = t ? !blow ? t.name === effect.ability.name ? `Preparando ${aim}` : `Prepara ${t.name} ${aim}` : `Después: ${t.name} ${aim}`
        : effect.cancelled && !blow ? 'Pierde el turno' : '';
      return { who, name: effect.ability.name, detail };
    }
    // The fights outside the fears' (the dogs, the palace's gum): their one blow.
    if (FEAR_ENCOUNTERS.includes(s.encounter as typeof FEAR_ENCOUNTERS[number]) || !effect.target || effect.amount === undefined) return;
    return { who, name: who.kind === 'minion' ? 'Escupitajo' : who.power !== undefined ? 'Puño de chicle' : 'Empujón', detail: '' };
  }
  /**
   * A foe's move named up top while it plays: whose, over the move, and what it announces. Up a
   * moment before the foe moves (BEAT.announce), it stays through the breath after, until the next
   * foe's takes its place or the party acts.
   */
  let calloutTimer: ReturnType<typeof setTimeout> | undefined;
  function showCallout(effect: BattleEffect) {
    const move = foeMoveOf(effect), el = get('.move-callout');
    clearTimeout(calloutTimer);
    if (!move) { hideCallout(); return false; }
    el.querySelector('.battle-kicker')!.textContent = move.who.name.toUpperCase();
    el.querySelector('strong')!.textContent = move.name;
    const small = el.querySelector('small')!;
    small.textContent = move.detail; small.hidden = !move.detail;
    // Restart its entrance for each move, the same foe twice in a row too.
    delete el.dataset.leaving; el.hidden = true; void el.offsetWidth; el.hidden = false;
    return true;
  }
  function hideCallout(after = 0) {
    const el = get('.move-callout');
    clearTimeout(calloutTimer);
    if (el.hidden) return;
    calloutTimer = setTimeout(() => {
      el.dataset.leaving = 'true';
      calloutTimer = setTimeout(() => { el.hidden = true; delete el.dataset.leaving; }, 200);
    }, after);
  }
  /**
   * La crecida's named pops (docs/animas/freatica/README.md § On the plates): «Agua I/II/III» on a rise in the water's colour
   * at that depth and «Hundido» as the third mark closes, Bombeo's mark spent, «Corriente» as a bolt charges the water,
   * «Bajo cero» as it freezes, and on the ice each blow's cracks, a flame's melt and «¡Roto!» with the break's own number.
   */
  function waterSays(effect: BattleEffect): { target: string; id: string; text: string; detail: string }[] {
    const says: { target: string; id: string; text: string; detail: string }[] = [];
    for (const w of effect.water ?? []) {
      if (w.to > w.from) says.push({ target: w.target, id: `agua-${w.to}`, text: w.to >= CRECIDA.marks && w.from < CRECIDA.marks ? '¡Hundido!' : `Agua ${roman(w.to)}`, detail: w.to >= CRECIDA.marks && w.from < CRECIDA.marks ? `Agua ${roman(w.to)}` : '' });
      else if (effect.skill === 'bombeo') says.push({ target: w.target, id: `agua-${Math.max(1, w.to)}`, text: w.to ? `Agua ${roman(w.to)}` : 'Sin agua', detail: 'Bombeo' });
      else if (effect.reaction?.id === 'vapor' || effect.hits?.some(h => h.target === w.target && h.smoked)) says.push({ target: w.target, id: 'vapor', text: '¡Vapor!', detail: w.to ? `Agua ${roman(w.to)}` : 'Sin agua' });
    }
    for (const id of effect.current?.targets ?? []) says.push({ target: id, id: 'corriente', text: effect.current!.renewed ? 'Corriente' : '¡Corriente!', detail: effect.current!.renewed ? `Otra vez ${effect.current!.seconds} s` : `${effect.current!.seconds} s` });
    for (const f of effect.frozen ?? []) says.push({ target: f.target, id: 'congelado', text: '¡Bajo cero!', detail: `Hielo ${roman(f.marks)}` });
    for (const i of effect.ice ?? []) {
      if (i.melted) says.push({ target: i.target, id: 'congelado', text: 'Se derrite', detail: 'Una marca de hielo' });
      else if (i.broke === undefined) says.push({ target: i.target, id: 'congelado', text: `Hielo ${i.cracks}/${CRECIDA.blows}`, detail: (i.added ?? 1) > 1 ? 'Golpe alto: cuenta por dos' : 'Se agrieta' });
    }
    if (effect.cells) for (const id of effect.cells.wetted) says.push({ target: id, id: 'mojado', text: `¡${TIMED.mojado.name}!`, detail: 'Las celdas se rompen' });
    return says;
  }
  /** The break of a frozen foe's ice: the largest number the ánima shows, slammed on as a golpe crítico's, «¡Roto!» under it. */
  function iceBreaks(effect: BattleEffect, token: number) {
    (effect.ice ?? []).filter(i => i.broke !== undefined).forEach((i, k) => setTimeout(() => {
      if (token !== generation) return;
      pop(i.target, `−${i.broke}`, 'crit', '¡Roto!', 'congelado');
      callbacks.sound('crit');
    }, 260 + k * 220));
  }
  /** One action on screen: a dual's banner or a foe's move named up top, Uri's shout from up on Vertitrón, then the action itself. */
  async function play(effect: BattleEffect, token: number) {
    callbacks.upcoming?.(effect);
    // A banner aimed for a dual that did not happen (its half no longer there) goes.
    if (!effect.dual && get('.dual-banner').dataset.armed) hideDualBanner();
    // A dual nobody had found: time stops first, to unlock it.
    if (effect.dual && !knownDual(effect.dual.id)) { await revealDual(effect); if (token !== generation) return; }
    const banner = effect.dual ? showDualBanner(effect) : undefined;
    const called = showCallout(effect);
    shout(effect);
    // A foe's move: its name is read a moment before it moves, with the fight's clock still.
    if (called) {
      root.dataset.announcing = 'true';
      try { await wait(BEAT.announce); } finally { delete root.dataset.announcing; }
      if (token !== generation) return;
    }
    // A blow that beats a foe of the maze: its word as the blow lands.
    lastWords(token, 420);
    await Promise.all([present(effect, token), banner]);
    if (banner) hideDualBanner();
    if (token !== generation) return;
    if (called) hideCallout(BEAT.breath + 700);
    remark(effect);
  }
  /** What happened between actions (a pulse that burnt out Vertitrón's eye). */
  async function flushNews(token: number) {
    while (state && token === generation && state.news?.length) {
      for (const news of takeNews(state)) {
        await play(news, token);
        if (token !== generation || !state) return;
        await wait(holdAfter(news));
      }
    }
  }
  let newsPlaying = false;
  async function showNews() {
    if (!state || busy || newsPlaying) return;
    newsPlaying = true;
    const token = generation;
    // Whatever was half chosen closes: the fight shows what just happened, then the turn goes on.
    // Split, nothing a move plays shuts either menu (`locked`), so each keeps what they had.
    if (state.phase === 'player' && !split()) collapse();
    busy = true;
    try { await flushNews(token); } finally { newsPlaying = false; }
    if (token !== generation || !state) return;
    busy = false; render();
    // Split, one may have confirmed while it played: theirs goes now, or it would wait for good.
    if (pending.length && state.phase === 'player') { void run(); return; }
    if (state.phase === 'player' && !targeting && !selected && !root.contains(document.activeElement)) focusFirst();
  }
  /** Atacar asks for a target, Habilidad opens its flyout to the right, Defender and Huir happen at once. */
  function choose(command: Command) {
    if (!state || blocked(command)) return;
    if (command === 'skill') get('[data-command="skill"]').classList.remove('is-new');
    if (selected === command) { collapse(true); render(); return; }
    collapse(); selected = command;
    get(`[data-command="${command}"]`).classList.add('expanded');
    if (command === 'attack') { beginTargeting(); return; }
    if (command !== 'skill' && command !== 'dual') { void execute(); return; }
    get(`[data-command="${command}"] .command-trigger`).setAttribute('aria-expanded', 'true');
    panelEl().dataset.flyout = 'open'; panelEl().dataset.sheet = command; get('.skill-flyout').inert = false;
    // The sheet slides out of its command and grows upwards from its bottom edge, over the scene, so
    // nothing else in the dock moves however many skills it holds.
    panelEl().style.setProperty('--flyout-bottom', `${get('.command-deck').getBoundingClientRect().bottom - get(`[data-command="${command}"]`).getBoundingClientRect().bottom}px`);
    if (command === 'dual') fillDuals(); else fillSkills();
    render();
    focusOn(skillButtons().find(b => !b.hasAttribute('aria-disabled')) ?? skillButtons()[0] ?? get<HTMLButtonElement>('.skill-flyout .command-back'));
  }
  /** The flyout's sheet: the active fighter's skills right now (an ánima swap refills it). */
  function fillSkills() {
    if (!state) return;
    pickingDie = undefined; selectedDie = undefined; delete get('.skill-list').dataset.dice; callbacks.aimDie?.();
    const actor = state.allies[state.active];
    get('.skill-flyout .battle-kicker').textContent = `HABILIDADES · ${actor.name.toUpperCase()}${actor.classId ? ` · ${animaOf(actor.classId, grownUp(actor.profile)).name.toUpperCase()}` : ''}`;
    // Unaffordable skills stay focusable so their details can still be read.
    get('.skill-list').innerHTML = skillsFor(state, actor).map((skill, i) => {
      const affordable = actor.secondary >= skill.cost;
      // Agitar is not an action: it costs nothing and reaches nobody, and what it has is uses.
      const free = 'free' in skill, uses = free ? shakesLeft(state!, actor) : 0;
      const available = free ? uses > 0 && diceOf(state!, actor).length > 0 : validTargets(state!, 'skill', skill.id).length > 0;
      const reason = free ? !uses ? 'Usado' : available ? uses === 1 ? '1 vez' : `${uses} veces` : 'Sin dados'
        : !affordable ? 'Sin maná' : available ? 'ulti' in skill ? 'Definitiva' : costPips(skill.cost) : skill.kind === 'boost' ? 'En marcha' : 'Sin objetivo';
      return `<button type="button" data-skill="${skill.id}" data-class="${skill.class}" ${!affordable || !available ? 'aria-disabled="true"' : ''} style="--i:${i}"><span class="skill-key">${i + 1}</span><span class="skill-name"><strong>${skill.name}</strong><small>${free ? 'Tu mano' : 'rain' in skill || 'volley' in skill ? 'Enemigos al azar' : 'hunt' in skill ? 'Quienes sangran' : 'hammer' in skill || 'freezes' in skill ? 'Quienes tienen agua' : 'raise' in skill ? 'Los ecos' : 'capo' in skill ? 'Los dúos y el maná' : ('screen' in skill || 'accompany' in skill || skill.kind === 'guard') && skill.side === 'allies' ? 'Un aliado' : TARGETS[skill.side]}</small></span><small class="skill-cost">${reason}</small></button>`;
    }).join('') + sleepingUlti(actor, skillsFor(state, actor).length) || '<p class="skill-empty">Sin habilidades con esta ánima.</p>';
    fitSkills();
  }
  /** The definitiva of the ánima `actor` wears, bought and asleep: a greyed row at the foot of the list, with how near it is to waking. */
  function sleepingUlti(actor: Combatant, i: number) {
    const asleep = state ? ultiProgress(state, actor) : undefined;
    if (!asleep) return '';
    const skill = SKILLS.find(sk => sk.id === asleep.skill)!;
    return `<button type="button" data-skill="${skill.id}" data-class="${skill.class}" data-asleep aria-disabled="true" style="--i:${i}"><span class="skill-key">${i + 1}</span><span class="skill-name"><strong>${skill.name}</strong><small>Definitiva</small></span><small class="skill-cost">${asleep.used ? 'Usada' : `Dormida · ${ultiMark(asleep)}`}</small></button>`;
  }
  /**
   * Dadista: the sheet turns into its hand, one row a die, each showing its face and what it does,
   * to pick which one Tirar dado spends (docs/animas/dadaista/). A die that can do nothing now (a
   * blank with nothing to repeat, brackets with nobody left to protect) is greyed out. The cursor
   * starts on the one that would go if nobody chose.
   */
  function fillDice(skill: SkillId, at?: number) {
    if (!state) return;
    const s = state, actor = s.allies[s.active], hand = diceOf(s, actor), spec = SKILLS.find(x => x.id === skill)!;
    pickingDie = skill;
    const list = get('.skill-list');
    list.dataset.dice = 'face';
    // Estrella fugaz is only paid with the die: any will do, and the row says what is given up.
    const paying = !faceUse(skill);
    get('.skill-flyout .battle-kicker').textContent = `${spec.name.toUpperCase()} · ${!paying ? 'ELIGE UN DADO' : spec.cost > 1 ? `GASTA ${spec.cost} DADOS · ELIGE EL PRIMERO` : 'ELIGE EL DADO QUE GASTA'}`;
    list.innerHTML = hand.map((face, i) => {
      const move = dieSkill(s, i), usable = paying || (!!move && validTargets(s, 'skill', skill, i).length > 0), as = faceAs(actor, face);
      const line = face === 'blanco' ? as ? `Repite ${FACE_NAMES[as]}: ${FACE_LINES[as]}` : 'Nada que repetir todavía' : FACE_LINES[face];
      return `<button type="button" data-die="${i}" data-class="${spec.class}" ${usable ? '' : 'aria-disabled="true"'} style="--i:${i}" aria-label="Dado ${i + 1}: ${FACE_NAMES[face]}. ${line}"><span class="skill-key">${i + 1}</span><i class="die-face" data-face="${face}" aria-hidden="true">${faceSvg(face)}</i><span class="skill-name"><strong>${FACE_NAMES[face]}</strong><small>${line}</small></span></button>`;
    }).join('');
    fitSkills();
    focusOn(list.querySelector<HTMLButtonElement>(`[data-die="${at ?? (paying ? spareDie(s) : bestDie(s))}"]`) ?? skillButtons()[0]);
  }
  /** The move being aimed: for Tirar dado once its die is picked, that die's face (`dieSkill`). */
  function aimSkill(): SkillId | undefined {
    return state && selectedSkill && faceUse(selectedSkill) && selectedDie !== undefined ? dieSkill(state, selectedDie) ?? selectedSkill : selectedSkill;
  }
  /**
   * The sheet shows a few skills at a time (`SKILL_ROWS`, fewer if the screen has no room above the
   * command): moving past the last one in sight slides the list on by a row, smoothly, keeping one
   * more in sight each way while there are more, and the rest wait faded at the edges with a ▲ / ▼
   * and how many. No scrollbar: the cursor, the wheel and the number keys move through it.
   */
  function fitSkills() {
    const list = get('.skill-list'), rows = [...list.querySelectorAll<HTMLElement>(':scope > button')];
    list.style.maxHeight = ''; delete list.dataset.window; list.dataset.start = '0';
    if (rows.length > 1) {
      const sheet = get('.skill-sheet'), gap = rows[1].offsetTop - rows[0].offsetTop - rows[0].offsetHeight;
      const from = (root.querySelector('.command.expanded') ?? get('.command-deck')).getBoundingClientRect().bottom;
      const room = from - SHEET_TOP - (sheet.offsetHeight - list.offsetHeight);
      const fit = Math.max(2, Math.min(SKILL_ROWS, Math.floor((room + gap) / (rows[0].offsetHeight + gap))));
      if (rows.length > fit) {
        list.dataset.window = String(fit);
        list.style.maxHeight = `${rows[fit - 1].offsetTop + rows[fit - 1].offsetHeight - rows[0].offsetTop}px`;
      }
    }
    list.scrollTop = 0;
    showMore(list, rows.length);
  }
  /** Slides the list so `button` is in sight, with one more row past it while there are more. */
  function keepInView(button: HTMLElement) {
    const list = get('.skill-list'), size = Number(list.dataset.window);
    if (!size) return;
    const rows = [...list.querySelectorAll<HTMLElement>(':scope > button')], at = rows.indexOf(button);
    if (at < 0) return;
    let start = Number(list.dataset.start ?? 0);
    if (at < start + 1) start = at - 1;
    if (at > start + size - 2) start = at - size + 2;
    start = Math.max(0, Math.min(rows.length - size, start));
    list.dataset.start = String(start);
    list.scrollTop = rows[start].offsetTop - rows[0].offsetTop;
    showMore(list, rows.length);
  }
  /**
   * The ▲ / ▼ with how many skills wait above and below, the fade on those edges, and the rail by the
   * sheet's edge: a segment per skill, the ones in sight lit, sliding with the list.
   */
  function showMore(list: HTMLElement, count: number) {
    const size = Number(list.dataset.window), start = Number(list.dataset.start ?? 0);
    const rail = get('.skill-rail');
    rail.hidden = !size;
    if (size) { rail.style.setProperty('--n', String(count)); rail.style.setProperty('--size', String(size)); rail.style.setProperty('--start', String(start)); }
    const above = size ? start : 0, below = size ? count - size - start : 0;
    list.toggleAttribute('data-above', above > 0); list.toggleAttribute('data-below', below > 0);
    for (const [way, n] of [['up', above], ['down', below]] as const) {
      const more = get(`.skill-more[data-more="${way}"]`);
      more.textContent = n ? `${way === 'up' ? '▲' : '▼'} ${n} más` : '';
      more.toggleAttribute('data-on', n > 0); more.hidden = !size;
    }
  }
  /**
   * L / R (Q / E on the keyboard), or a click on a pill: the active fighter swaps ánima. Free, the
   * turn stays theirs, and their interface changes in one gesture: the old one leaves fading as the
   * new one slides in from the other side (`.is-swapping` in style.css), and their face lights up.
   */
  let lastSwap: ViewTransition | undefined;
  function changeAnima(choice: -1 | 1 | ClassId) {
    if (!state || locked() || targeting || state.phase !== 'player' || callbacks.waiting(state.allies[state.active].id)) return;
    const actor = state.allies[state.active];
    const next = typeof choice === 'number' ? switchAnima(state, choice) : wearAnima(state, choice) ? choice : undefined;
    const dock = dockOf(actor.id), switcher = dock.querySelector<HTMLElement>('.anima-switch')!;
    switcher.classList.remove('is-stuck'); void switcher.offsetWidth;
    if (!next) { callbacks.sound('denied'); switcher.classList.add('is-stuck'); return; }
    callbacks.sound('anima-swap');
    // The view transition runs `putOn` a frame later, once `withPlayer` has put the other player's
    // menu back: it works on this player's menu again, or their skills would fill the friend's sheet.
    const player: PlayerId = split() ? ctx : 1;
    const putOn = () => withPlayer(player, () => {
      callbacks.anima(actor.id, next);
      showDetails(false);
      render();
      flashAnima(root.querySelector(`.party-card[data-unit="${actor.id}"] .vitals-avatar`), CLASSES[next].colour);
      if (selected === 'skill' || selected === 'dual') {
        if (selected === 'dual') fillDuals(); else fillSkills();
        focusOn(skillButtons().find(b => !b.hasAttribute('aria-disabled')) ?? skillButtons()[0] ?? get<HTMLButtonElement>('.skill-flyout .command-back'));
      }
    }, true);
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { putOn(); return; }
    // The browser keeps a picture of the old interface, so it leaves in its own look with the ánima
    // already changed and nothing waiting. Aitor's dock mirrors it, as it does everything else.
    document.documentElement.style.setProperty('--swap-way', mirrored() ? '-1' : '1');
    dock.classList.add('is-swapping');
    const swap = lastSwap = document.startViewTransition(putOn);
    void swap.finished.finally(() => { if (lastSwap === swap) dock.classList.remove('is-swapping'); });
  }
  /**
   * A dual between the two players (docs/combat.md § Ataques duales): while one is aiming a skill,
   * the other picks the skill that completes it, and both are now aiming the dual. Either can back
   * out (each goes back to what they had); it goes off once both have picked the same foe. Only a
   * dual already found: one not found yet happens by chance instead (`chanceDual`).
   */
  let duo: { id: DualId; die?: number; skills: Record<PlayerId, SkillId>; aims: Partial<Record<PlayerId, string>> } | undefined;
  const other = (p: PlayerId): PlayerId => p === 1 ? 2 : 1;
  /** Whether picking `skill` now completes the other player's aimed one into a dual; it starts it if so. */
  function joinDual(skill: SkillId) {
    const s = state!, them = menus[other(ctx)], partner = allyOf(other(ctx)), me = allyOf(ctx);
    if (!split() || duo || !partner || !me || !canAct(partner) || !them.targeting || them.selected !== 'skill' || !them.selectedSkill) return false;
    const d = dualOf(skill, them.selectedSkill);
    if (!d || !knownDual(d.id) || !dualReady(s, d, me, partner)) return false;
    duo = { id: d.id, die: selectedDie ?? them.selectedDie, skills: { [ctx]: skill, [other(ctx)]: them.selectedSkill } as Record<PlayerId, SkillId>, aims: {} };
    for (const p of [1, 2] as PlayerId[]) menus[p] = { selected: 'dual', selectedDual: d.id, targeting: true };
    loadMenu(ctx);
    showDetails(false);
    render();
    focusOn(targetButtons()[0]);
    withPlayer(other(ctx), () => focusOn(targetButtons()[0]));
    return true;
  }
  /** Leaves the dual: the one backing out goes back to their skills, the other to aiming their own skill. */
  function leaveDual() {
    if (!duo) return;
    const mine = duo.skills[ctx], theirs = duo.skills[other(ctx)];
    duo = undefined;
    menus[other(ctx)] = { selected: 'skill', selectedSkill: theirs, targeting: true };
    collapse(); choose('skill');
    focusOn(scope().querySelector<HTMLButtonElement>(`[data-skill="${mine}"]`));
    render();
  }
  /**
   * A dual not found yet, by chance: confirming `skill` while the other player has the skill that
   * completes it picked (aiming it, or confirmed and waiting its turn) sets it off, with no warning
   * before. Nothing was armed: the two of them just happened to choose it, and time stops to unlock
   * it (`revealDual`). Aimed where the one confirming aimed, else where the other's was going.
   */
  function chanceDual(skill: SkillId, target?: string): Job | undefined {
    const s = state!, me = allyOf(ctx), partner = allyOf(other(ctx)), them = menus[other(ctx)];
    if (!split() || duo || !me || !partner || partner.hp <= 0 || callbacks.waiting(partner.id)) return;
    const waiting = pending.find(j => j.ally === partner.id && j.command === 'skill' && j.skill);
    const aiming = canAct(partner) && them.targeting && them.selected === 'skill' ? them.selectedSkill : undefined;
    const theirs = waiting?.skill ?? aiming, d = theirs && dualOf(skill, theirs);
    if (!d || knownDual(d.id) || !dualReady(s, d, me, partner)) return;
    // Where the partner was going: confirmed and waiting, or still aiming (read before their menu closes).
    const partnerAim = waiting ? waiting.target : aimedBy[other(ctx)];
    if (waiting) pending.splice(pending.indexOf(waiting), 1);
    else withPlayer(other(ctx), () => collapse());
    // Trampantojo found by Confusión's confirm goes where the Cortina was aimed, not to the first ally.
    const foes = dualTargets(s, d).map(f => f.id), aim = [aimed(skill) ? target : undefined, partnerAim].find(t => t && foes.includes(t));
    return { player: ctx, ally: me.id, command: 'dual', dual: d.id, die: selectedDie ?? waiting?.die ?? them.selectedDie, target: aim, text: dualText(d, aim) };
  }
  /** «Zarpazos de fuego → Canela»; one with nobody to pick, at whom it goes: «Vulcano → Todos los enemigos». */
  function dualText(d: DualSpec, aim?: string) {
    const whom = dualSingle(d) ? [...state!.foes, ...state!.allies].find(f => f.id === aim)?.name ?? '' : d.side === 'allies' ? 'Todo el equipo' : 'Todos los enemigos';
    return `${d.name} → ${whom}`;
  }
  /** Whether `skill` goes to the party's side (a cure, a guard, a boost for everyone): their cards are what is picked. */
  const toParty = (skill: SkillId) => ['allies', 'party'].includes(SKILLS.find(x => x.id === skill)!.side);
  /**
   * What is being aimed reaches a whole side (a dual on every foe or the party, or split, a skill with
   * no target being confirmed): «Todo el equipo» or «Todos los enemigos»; nothing when one is picked.
   */
  function wholeSide() {
    const dual = aimedDual(), skill = selected === 'skill' && selectedSkill && !aimed(selectedSkill) ? SKILLS.find(x => x.id === selectedSkill) : undefined;
    const side = dual ? (dualSingle(dual) ? undefined : dual.side) : skill?.side;
    return !side ? undefined : side === 'allies' || side === 'party' ? 'Todo el equipo' : 'Todos los enemigos';
  }
  /** The target picker's title and line for what the menu being worked on is aiming. */
  function pickerText() {
    const s = state!, skill = aimSkill();
    const cure = aimedDual()?.side === 'allies' || selected === 'skill' && !!skill && toParty(skill);
    const guard = cure && SKILLS.find(x => x.id === skill)?.kind === 'guard', whole = wholeSide();
    get('.target-picker h2').textContent = selected === 'skill' && skill ? SKILLS.find(x => x.id === skill)!.name : selected === 'dual' ? DUALS.find(d => d.id === selectedDual)?.name ?? 'Dual' : attackName(s.allies[s.active]);
    const standing = s.foes.filter(f => f.hp > 0);
    const mine = duo?.aims[ctx], theirs = duo?.aims[other(ctx)], single = !duo || dualSingle(DUALS.find(d => d.id === duo!.id)!);
    get('.target-picker p').textContent = duo ? single && mine && theirs && mine !== theirs ? 'Elegid el mismo objetivo.' : mine ? 'Esperando al otro…' : single ? 'Los dos, al mismo objetivo.' : 'Confirmad los dos.'
      : whole ? `Llega a ${whole === 'Todo el equipo' ? 'todo el equipo' : 'todos los enemigos'}.` : guard ? 'Elige a quién proteger.' : cure ? 'Elige a quién curar.' : FEAR_KICKERS[s.encounter as keyof typeof FEAR_KICKERS] ? standing.length === 1 ? `Elige a ${standing[0].name}.` : 'Elige un enemigo.' : s.encounter === 'palace-minion' ? 'Elige al esbirro.' : s.encounter === 'night-guard' && s.foes.some(f => isCastle(f.kind)) ? standing.length === 1 ? `Elige a ${standing[0].name}.` : 'Elige un enemigo.' : s.encounter === 'palace-guards' || s.encounter === 'night-guard' ? 'Elige un guardián.' : 'Elige un perro en la calle.';
  }
  /**
   * Agitar: the hand is thrown again there and then, and the turn goes on with the list still open
   * (docs/animas/dadaista/ § Agitar). The dice tumble in the fight, and a pop over the wearer says
   * what came of it: another hand, or the Comodín the Racha brought.
   */
  function shakeHand() {
    if (!state) return;
    const actor = state.allies[state.active], got = shake(state);
    if (!got) { callbacks.sound('ui-back'); return; }
    callbacks.sound('clink'); callbacks.shakeDice?.(actor.id);
    pop(actor.id, 'Agitar', 'status', got.comodin !== undefined ? '¡Comodín!' : 'Otra mano', 'racha');
    render(); fillSkills();
    focusOn(scope().querySelector<HTMLButtonElement>('[data-skill="agitar"]') ?? skillButtons()[0]);
  }
  function beginTargeting(skill?: SkillId) {
    if (!state || locked() || !selected) return;
    if (skill && 'free' in SKILLS.find(s => s.id === skill)!) { shakeHand(); return; }
    if (skill && (state.allies[state.active].secondary < SKILLS.find(s => s.id === skill)!.cost || !validTargets(state, 'skill', skill, dieUse(skill) ? selectedDie : undefined).length)) return;
    showDetails(false);
    // Dadista: first the die it spends, then whom. A hand of one has nothing to pick.
    if (skill && dieUse(skill) && selectedDie === undefined) {
      // …nor one that all goes (Asteroide's three out of three).
      if (diceOf(state, state.allies[state.active]).length > Math.max(1, faceUse(skill) ? 1 : SKILLS.find(s => s.id === skill)!.cost)) { callbacks.sound('ui-confirm'); fillDice(skill); return; }
      selectedDie = 0;
    }
    if (skill && joinDual(skill)) return;
    pickingDie = undefined;
    // A skill that reaches the whole party has nobody to pick: it happens at once. Split, while the
    // partner can still choose, it is confirmed like any other (the whole side lit), so they have the
    // same moment to complete a dual with it whichever of the two is chosen first.
    if (skill && !aimed(skill) && !(split() && canAct(allyOf(other(ctx))))) { selectedSkill = skill; void execute(); return; }
    selectedSkill = skill; targeting = true;
    render();
    focusOn(targetButtons()[0]);
  }
  function back() {
    if (locked()) return;
    if (details) { showDetails(false); return; }
    if (duo && targeting && selected === 'dual') { leaveDual(); return; }
    if (pickingDie && !targeting) {
      // From the hand back to the skills.
      const oldSkill = pickingDie;
      fillSkills();
      focusOn(scope().querySelector<HTMLButtonElement>(`[data-skill="${oldSkill}"]`));
    } else if (targeting && selected === 'skill') {
      const oldSkill = selectedSkill, oldDie = selectedDie, hand = oldSkill && dieUse(oldSkill) && state ? diceOf(state, state.allies[state.active]).length : 0;
      collapse(); choose('skill');
      if (oldSkill && hand > 1) fillDice(oldSkill, oldDie);
      else focusOn(scope().querySelector<HTMLButtonElement>(`[data-skill="${oldSkill}"]`));
    } else if (targeting && selected === 'dual') {
      const oldDual = selectedDual;
      collapse(); choose('dual');
      focusOn(scope().querySelector<HTMLButtonElement>(`[data-dual="${oldDual}"]`));
    } else { collapse(true); render(); }
  }
  async function present(effect: BattleEffect, token: number) {
    if (!state) return;
    root.dataset.resolving = 'true';
    root.dataset.actor = effect.actor;
    root.querySelectorAll<HTMLElement>('[data-unit]').forEach(card => card.classList.toggle('is-acting', card.dataset.unit === effect.actor));
    articles().forEach(article => { article.querySelector<HTMLButtonElement>('.command-trigger')!.disabled = true; });
    get('.turn-meta').textContent = 'EN ACCIÓN';
    // A flurry on one target (Zarpazos' claws, Foc Binari's zero and one): each blow takes its own PV
    // off the bar and shows its own number as it lands, and a fire it carries catches with the blow
    // that lit it; whatever else it says comes with the last one.
    const strikes = effect.target && !effect.hits && (effect.strikes?.length ?? 1) > 1 ? effect.strikes! : undefined;
    // What the action is called on its numbers: the party's skill or dual. A foe's is named up top (`showCallout`) instead.
    const label = effect.kind === 'enemy' ? (isCuerdas(state.foes.find(f => f.id === effect.actor)?.kind) && !effect.cancelled ? effect.ability?.name ?? '' : '') : DUALS.find(d => d.id === effect.detonation)?.name ?? effect.release?.name ?? effect.pounceDual?.name ?? effect.dual?.name ?? SKILLS.find(s => s.id === effect.skill)?.name ?? (effect.element ? ELEMENTS[effect.element].name : '');
    const spread = (blow: number) => strikes ? (blow / (strikes.length - 1) - .5) * 48 : 0;
    // Rayo solar's beam sweeps along the foes: each one's blow (its number, its PV, its fire) lands
    // as the beam crosses them, blow 1 + its place in `hits` (the scene's `solarCross`).
    const sweep = effect.release && effect.hits?.length ? effect.hits : undefined;
    const sweepOwed = new Map(sweep?.map(h => [h.target, owed.get(h.target) ?? 0] as const));
    // Dados astrales: each die of light takes its own PV off and shows its own number as it lands (blow = its place in `rain`).
    // Papagato's claws one after another (Cacería, Siete vidas): the same, each on the foe it found.
    // Golpe de ariete's blows too: one a mark of each foe's water, each with its own number.
    const rain = effect.rain?.length ? effect.rain : effect.volley?.length ? effect.volley : effect.hunt?.length ? effect.hunt : effect.hammer?.length ? effect.hammer : undefined;
    const scatter = (i: number) => ((i * 7) % 5 / 4 - .5) * 64;
    // Statuses that landed show a beat after the last blow.
    const landed: { target: string; id: string; text: string; detail: string }[] = [];
    // After a wound opened (its own pop comes first), a little later.
    let wounded = false;
    // Several on the same fighter (Conducción, then Shock, then Quemado) come one after another, not on top of each other.
    const stamp = () => {
      const nth = new Map<string, number>();
      landed.forEach(l => {
        // Each one after the first a row higher (a status pop is about 44 px tall), so one still rising never prints over the next.
        const k = nth.get(l.target) ?? 0; nth.set(l.target, k + 1);
        setTimeout(() => { if (token === generation) pop(l.target, l.text, 'status', l.detail, l.id, 0, 46 * k); }, (wounded ? 560 : 170) + k * 380);
      });
    };
    let say = '';
    // A golpe crítico's number (docs/animas/README.md § Golpe crítico): much bigger, slammed on while the
    // fight holds still, and it says so; with a wound spent under it, how much the wound added as well.
    const woundOf = (id: string) => id === effect.target ? effect.bled ?? 0 : effect.hits?.find(h => h.target === id)?.bled ?? 0;
    const critPop = (id: string, amount: number, first: boolean, dx?: number) => {
      const bled = first ? woundOf(id) : 0;
      return pop(id, `−${amount}`, 'crit', bled ? `¡Crítico! · Sangrado +${Math.round((woundScale(bled, effect.skill) - 1) * 100)}%` : '¡Crítico!', bled ? 'sangrado' : undefined, dx);
    };
    /** Whether the blow's first number on `id` is a golpe crítico's. */
    const critOn = (id: string) => id === effect.target && !effect.hits ? !!effect.crit && effect.crits?.[0] !== false : !!effect.hits?.find(h => h.target === id)?.crit;
    const hurtPop = (id: string, amount: number, detail: string, dx?: number, crit = false) => crit ? critPop(id, amount, dx === undefined || !strikes || dx === spread(0), dx) : pop(id, `−${amount}`, 'damage', detail, undefined, dx);
    const knock = () => {
      const card = root.querySelector<HTMLElement>(`[data-unit="${effect.target ?? effect.actor}"]`);
      card?.classList.remove('contact-hit');
      // Restart the local accent on each contact, including repeated targets.
      if (card) { void card.offsetWidth; card.classList.add('contact-hit'); }
    };
    // The fire this action carries, as blow `blow` lands: rolled claw by claw, each level says so as
    // it comes, in the same place, the last replacing the one before; otherwise with its last blow.
    let firePop: HTMLElement | undefined;
    const landFire = (blow: number) => {
      const held = effect.target ? heldFire.get(effect.target) : undefined;
      if (!held) return;
      const target = [...state!.allies, ...state!.foes].find(c => c.id === effect.target)!, was = shownFire(target)?.level ?? 0;
      if (strikes && blow < strikes.length - 1) held.landed = blow + 1; else heldFire.delete(effect.target!);
      const level = shownFire(target)?.level ?? 0;
      if (!effect.burns || !effect.burn || level <= was) return;
      firePop?.remove();
      firePop = pop(effect.target!, `¡${TIMED[effect.burn.id].name}${level > 1 ? ` ${roman(level)}` : ''}!`, 'status', level > 1 ? 'El fuego sube' : '', effect.burn.id);
    };
    // Atractor extraño: each other foe's plate lets go of what it gave as its statuses rise off it (the scene's `atractorGiven`),
    // but not of a fire its Estallido is still to light there.
    effect.gathered?.forEach((g, i) => setTimeout(() => {
      if (token !== generation || !unlanded) return;
      released.add(g.from);
      if (effect.gathered!.some(c => c.reactions.some(r => r.hits?.some(h => h.target === g.from)))) heldFire.set(g.from, { landed: 0 }); else heldFire.delete(g.from);
      render();
    }, atractorGiven(i) * 1000));
    await callbacks.change(state, effect, blow => {
      if (token !== generation || !state) return;
      if (blow && rain) {
        const drop = rain[blow];
        if (!drop) return;
        owed.set(drop.target, Math.max(0, (owed.get(drop.target) ?? 0) - drop.amount));
        render(); knock();
        hurtPop(drop.target, drop.amount, '', scatter(blow), 'crit' in drop && !!drop.crit);
        return;
      }
      if (blow && sweep) {
        const h = sweep[blow - 1];
        if (!h) return;
        owed.delete(h.target); heldFire.delete(h.target);
        render();
        pop(h.target, `−${h.amount}`, 'damage', label);
        const says = [...h.burn ? [{ id: h.burn.id, text: `¡${TIMED[h.burn.id].name} ${roman(h.burn.level)}!`, detail: '' }] : [], ...h.status ? [{ id: h.status.id, text: `¡${STATUSES[h.status.id].name}!`, detail: `× ${h.status.stacks}` }] : []];
        says.forEach(l => setTimeout(() => { if (token === generation) pop(h.target, l.text, 'status', l.detail, l.id); }, 170));
        return;
      }
      if (blow) {
        if (strikes?.[blow] === undefined) return;
        owed.set(effect.target!, Math.max(0, (owed.get(effect.target!) ?? 0) - strikes[blow]));
        landFire(blow);
        render(); knock();
        const last = blow === strikes.length - 1;
        if (effect.crits?.[blow]) critPop(effect.target!, strikes[blow], false, spread(blow));
        else hurtPop(effect.target!, strikes[blow], last && say !== label ? say : '', spread(blow));
        if (last) stamp();
        return;
      }
      // Its first blow lands: everything comes off but a flurry's other blows.
      unlanded = false; released.clear();
      const held = new Map(owed);
      owed.clear();
      // Atractor extraño: the fires it took off the others (and any its Estallido lit) go as it lands, not once it is over.
      if (effect.gathered) heldFire.clear();
      // Rayo solar: the foes its beam has yet to cross keep their PV and fire on screen until it does.
      sweepOwed.forEach((amount, id) => { if (amount) owed.set(id, amount); });
      if (strikes) owed.set(effect.target!, strikes.slice(1).reduce((sum, amount) => sum + amount, 0));
      rain?.slice(1).forEach(drop => owed.set(drop.target, (owed.get(drop.target) ?? 0) + drop.amount));
      // What is still to land never puts back more than the action took: a blow that took less than its number
      // (a Gemelo held up at 1 PV, a fall the rules stopped) never makes the bar grow under it.
      if (strikes || rain) for (const [id, amount] of owed) if (!sweepOwed.has(id)) owed.set(id, Math.min(amount, Math.max(0, held.get(id) ?? 0)));
      if (!sweep) landFire(0);
      render(); knock();
      const target = [...state.allies, ...state.foes].find(c => c.id === (effect.target ?? effect.actor));
      // What went up or down, a moment after the blow's own number (a boost already says it).
      if (!effect.boosted) effect.stats?.forEach(change => setTimeout(() => token === generation && pop(change.target, `${statNames(change.stats)} ${change.way === 'down' ? '▼' : '▲'}`, change.way === 'down' ? 'stat-down' : 'stat-up'), 420));
      // Las cuerdas' moves that are not a blow say so over whoever they change (docs/quests/marta.md).
      if (effect.lazo) pop(effect.lazo.target, `+${effect.lazo.amount}`, 'heal', effect.lazo.back ? 'Lazo · vuelve' : 'Lazo');
      if (effect.cracked) setTimeout(() => { if (token === generation) pop(effect.actor, '¡Rajado!', 'status', 'Ya no devuelve la magia', 'rajado'); }, 420);
      if (effect.stuck) setTimeout(() => { if (token === generation) pop(effect.actor, 'Clavado', 'status', 'Recibe más daño', 'clavado'); }, 420);
      // El Campeón's Plan set back by magic, and his Etapa II (src/battle.ts `checkCampeon`).
      const champion = state?.foes.find(f => f.kind === 'campeon');
      if (champion && effect.foiled) setTimeout(() => { if (token === generation) pop(champion.id, '¡Plan frustrado!', 'status', `Plan ${effect.plan ?? 0}/${planMost(champion)}`, 'plan'); }, 420);
      if (champion && effect.stage2) setTimeout(() => { if (token === generation) pop(champion.id, 'Etapa II', 'status', 'Su plan se cumple antes', 'etapa'); }, 760);
      if (effect.summoned) pop(effect.summoned, effect.summoned.startsWith('polilla') ? 'Otra polilla' : 'Segunda voz', 'status', effect.summoned.startsWith('polilla') ? 'Atraída por la luz' : 'Coro', 'cristal');
      // The castle's rules turning (src/castle-fight.ts): «Se lo aprende», «Sin atril», «Tropiezo», «Suyo», «Libre»…
      effect.called?.forEach((call, i) => setTimeout(() => { if (token === generation) pop(call.target, call.text, 'status', call.detail ?? '', call.status); }, 420 + i * 240));
      // Fran's salon's moves that are not a blow (docs/quests/luca.md).
      if (effect.brillo !== undefined && effect.kind === 'enemy' && !effect.lampBroken) pop(effect.actor, `Brillo ${effect.brillo}`, 'status', 'Bebe la luz', 'brillo');
      if (effect.lampBroken) setTimeout(() => {
        if (token !== generation || !state) return;
        pop(effect.lampBroken!, '¡Estalla!', 'status', 'Fran pierde el brillo', 'rajado');
        // Its colour rains back on the party: what that light ate, back in their hands.
        const lamp = state.foes.find(f => f.id === effect.lampBroken)?.lamp;
        const back = lamp ? [...new Set(LAMPS[lamp].lights.map(cancels).filter((e): e is AttackElement => !!e && e !== 'fisico'))] : [];
        if (back.length) for (const ally of state.allies.filter(a => a.hp > 0)) pop(ally.id, `Vuelve ${back.map(e => ELEMENTS[e].name.toLowerCase()).join(' y ')}`, 'status', 'La luz ya no lo anula', 'luz')?.style.setProperty('--status', LIGHTS[LAMPS[lamp!].lights[0]].colour);
      }, 420);
      if (effect.stage) setTimeout(() => { if (token !== generation || !state) return; const fran = state.foes.find(f => f.kind === 'fran'); if (fran) pop(fran.id, effect.stage === 2 ? 'Se levanta' : 'El hisopo', 'status', effect.stage === 2 ? 'Bajan las lámparas' : 'Aspersión en su próximo turno', 'crescendo'); }, 600);
      // La carta de colores: a blow on a shirt out of its light does nothing; one fallen takes its light with it, and what that light ate comes back.
      if (effect.unlit) effect.unlit.forEach(id => pop(id, 'Nada', 'status', 'Fuera de su luz', 'apagada'));
      if (effect.lightOut && state.foes.some(f => f.hp > 0)) setTimeout(() => {
        if (token !== generation || !state) return;
        const light = effect.lightOut!, back = cancels(light);
        if (back && back !== 'fisico') for (const ally of state.allies.filter(a => a.hp > 0)) pop(ally.id, `Vuelve ${ELEMENTS[back].name.toLowerCase()}`, 'status', `La luz ${LIGHTS[light].name.toLowerCase()} se apaga`, 'luz')?.style.setProperty('--status', LIGHTS[light].colour);
      }, 420);
      if (effect.stopped) setTimeout(() => { if (token === generation) effect.stopped!.forEach(id => pop(id, 'Quieto', 'status', 'Sin nadie a quien copiar', 'clavado')); }, 420);
      if (effect.kind === 'enemy' && effect.shielded && isCuerdas(state.foes.find(f => f.id === effect.actor)?.kind)) pop(effect.actor, 'Guardia', 'guard');
      // A blow went through La Voz while she sang: she is angered, over her, as it goes through (her next note may be close).
      if (effect.angered) { const voz = state.foes.find(f => f.kind === 'voz'); if (voz) pop(voz.id, 'Se enfada', 'status', effect.angered > 1 ? `Enfado ${roman(effect.angered)}` : 'Su siguiente nota, más fuerte', 'enfado'); }
      if (effect.kind === 'enemy' && effect.telegraph?.id === 'calderon') pop(effect.actor, 'Toma aire', 'status', 'Calderón en su próximo turno', 'crescendo');
      if (effect.cancelled === 'calderon') pop(effect.kind === 'enemy' ? effect.actor : effect.target ?? effect.actor, effect.kind === 'enemy' ? 'Sin aire' : '¡Calderón roto!', 'status', effect.kind === 'enemy' ? 'Pierde el turno' : 'Acorde', 'sin-aire');
      // Estrella fugaz spent the Racha for dice: said over whoever threw it, a beat after the blow.
      if (effect.starred) setTimeout(() => { if (token === generation) pop(effect.actor, `Racha −${effect.starred}`, 'status', effect.rain ? `${effect.rain.length} dados de luz` : effect.dealt?.length ? effect.dealt.length === 1 ? '+1 dado' : `+${effect.dealt.length} dados` : '', 'racha'); }, 420);
      // The meteor grew: said over whoever threw it, so the list's new row is no surprise.
      if (effect.meteor) { const next = SKILLS.find(s => 'meteor' in s && s.meteor === effect.meteor)!; setTimeout(() => { if (token === generation) pop(effect.actor, next.name, 'status', 'En tu siguiente turno', 'racha'); }, effect.starred ? 900 : 420); }
      if (effect.kind === 'defend') pop(effect.actor, 'En guardia', 'guard', effect.charged ? `Maná +${effect.charged}` : '');
      if (effect.noWayOut) pop(effect.actor, 'Sin salida', 'stat-down');
      else if (effect.boosted && effect.skill) { const skill = effect.skill; const spec = SKILLS.find(s => s.id === skill)!; effect.boosted.forEach(id => 'double' in spec ? pop(id, spec.name, 'status', 'Crítico ×2', 'racha') : pop(id, 'screen' in spec ? `${boostedStats(skill)} ▲` : spec.name.split(' ')[0], 'screen' in spec ? 'stat-up' : 'guard', 'screen' in spec ? '' : `${boostedStats(skill)} +${state!.boosts?.[skill]?.amount ?? 0}`)); }
      else if (effect.annulled) {
        // Fran's salon: the light ate the blow. Said over whoever it was aimed at, in the light's colour.
        const light = effect.annulled;
        for (const id of effect.hits?.map(h => h.target) ?? (effect.target ? [effect.target] : [])) pop(id, 'Anulado', 'status', `Luz ${LIGHTS[light].name.toLowerCase()}`, 'anulado')?.style.setProperty('--status', LIGHTS[light].colour);
      }
      else if (effect.swallowed && effect.target) pop(effect.target, '0', 'guard', '¡Se lo traga!');
      else if (effect.dual?.id === 'reserva-de-color' && effect.target) pop(effect.target, 'Mecha encendida', 'status', 'Estalla al actuar o caer', 'empolvado');
      else if (effect.healedAll) effect.healedAll.forEach(h => pop(h.target, `+${h.amount}`, 'heal', label));
      // A cure on someone whole under the bit dome went into the dome: its own pop says so (below).
      else if (effect.healed && effect.target) { if (effect.amount || !effect.bits?.mended) pop(effect.target, `+${effect.amount ?? 0}`, 'heal', label); }
      // A skill that only leaves a status (Rayo de sanación, Confusión, Rayo encogedor) or raises the bit dome says so below, with no number.
      else if (effect.regen || (effect.afflicted && !effect.amount) || (effect.bits?.raised && !effect.dual)) { /* its status pops below */ }
      // A dual that deals no blow (a boost, a dome, a cortina, an eco left in a foe): what it left pops below, with no number.
      else if (effect.dual && ['boost', 'guard', 'eco'].includes(DUALS.find(d => d.id === effect.dual!.id)?.kind ?? '')) { /* its pops below */ }
      // Sincopante's that strike nobody (Crescendo, Acompañamiento, Da capo): what they did pops below, with no number.
      else if (effect.ecosRaised || effect.dacapo || (effect.ecoCalled?.kind === 'acompanamiento')) { /* its pops below */ }
      else if (sweep) { /* each foe's number comes as the beam crosses them (above) */ }
      // Bajo cero: no blow; the ice says so over each foe it took (below).
      else if (effect.frozen) { /* its stamps below */ }
      // The bit dome stopped the whole blow: nothing reached them, the dome's own pop says what it took (below).
      else if (effect.kind === 'enemy' && effect.bits?.took && !effect.amount && !effect.hits?.some(h => h.amount > 0)) { /* the dome's pop */ }
      // Cegado: a blinded foe's physical blow went past everyone it was meant for; whatever did land shows its number.
      else if (effect.kind === 'enemy' && effect.missed?.length) {
        const missed = new Set(effect.missed);
        for (const id of missed) missPop(id);
        if (effect.target && !missed.has(effect.target) && effect.amount) hurtPop(effect.target, effect.amount, label);
        effect.hits?.forEach(h => { if (!missed.has(h.target) && h.amount) pop(h.target, `−${h.amount}`, 'damage', label); });
        effect.splash?.forEach(h => { if (!missed.has(h.target) && h.amount) pop(h.target, `−${h.amount}`, 'damage', ''); });
      }
      else if (rain) hurtPop(rain[0].target, rain[0].amount, label, scatter(0), 'crit' in rain[0] && !!rain[0].crit);
      else if (effect.hits) effect.hits.forEach(h => h.target === effect.lives?.target ? livesPop(h.target, effect.lives) : h.crit ? critPop(h.target, h.amount, true) : pop(h.target, `−${h.amount}`, 'damage', h.peeled ? peelText(h.peeled, state!.foes.find(f => f.id === h.target)) : label));
      else if (effect.target && target) {
        // A big onion's weight falls on the others as well.
        effect.splash?.forEach(other => pop(other.target, `−${other.amount}`, 'damage', isOnion(state!.foes.find(f => f.id === effect.actor)?.kind) ? '¡Qué peso!' : ''));
        say = target.hp === 0 ? '¡Fuera!' : effect.confused ? 'Confundido' : effect.melted ? '¡Se derrite!' : effect.peeled ? peelText(effect.peeled, target) : target.guarding ? 'Protegido' : label;
        // A flurry's first blow carries the skill's name; the others follow as they land (above).
        // Corchete: no number, the ally between brackets says so.
        if (effect.guarded) pop(effect.target, 'Protegido', 'guard', label);
        // Siete vidas: the blow that would have felled them turns into a cure.
        else if (effect.lives?.target === effect.target) livesPop(effect.target, effect.lives);
        // Acecho: nothing lands yet; the crouch says so over the wearer (below).
        else if (effect.stalking) { /* its stamp below */ }
        else if (strikes) hurtPop(effect.target, strikes[0], label, spread(0), critOn(effect.target));
        else if (!effect.controlled) hurtPop(effect.target, effect.amount ?? 0, say, undefined, critOn(effect.target));
      }
      if (effect.sutureSpent) landed.push({ target: effect.sutureSpent, id: 'sanacion', text: 'La sutura aguanta', detail: 'Daño a la mitad' });
      // Cortinas of powder: the screen that stood up, the one a blow went through, and whoever it burst over (Rebufo).
      effect.cortina?.raised?.forEach(id => landed.push({ target: id, id: 'cortina', text: 'Cortina', detail: 'El siguiente golpe, a la mitad' }));
      effect.cortina?.broke?.forEach(id => landed.push({ target: id, id: 'cortina', text: 'La cortina aguanta', detail: 'Daño a la mitad' }));
      if (effect.cortina?.rebufo) landed.push({ target: effect.cortina.rebufo, id: 'empolvado', text: `¡${TIMED.empolvado.name}!`, detail: 'Rebufo' });
      // Fin de fiesta: each puff's exit over every foe, one after another; the blast's numbers are the blow's own (`hits`).
      if (effect.finale) {
        const f = effect.finale;
        f.burns.forEach(b => landed.push(fireSays(b.target, 'quemado', b.level)));
        f.poisoned.forEach(v => landed.push({ target: v.target, id: 'envenenado', text: `¡${TIMED.envenenado.name}${v.level > 1 ? ` ${roman(v.level)}` : ''}!`, detail: '' }));
        f.crystallised.forEach(id => landed.push({ target: id, id: 'cristalizado', text: `¡${TIMED.cristalizado.name}!`, detail: '' }));
      }
      // The definitiva woke: said over whoever wears it, and its command is in their list from now on.
      if (effect.awoken) { const awoken = effect.awoken; setTimeout(() => { if (token === generation) ultiAwoke(awoken); }, 900); }
      if (effect.detonation === 'bombardeo-orbital') {
        for (const h of effect.hits ?? []) if (h.amount && state!.foes.find(f => f.id === h.target)?.timed?.cegado) {
          landed.push({ target: h.target, id: 'cegado', text: `¡${TIMED.cegado.name}!`, detail: `${ORBITAL_BLIND} s` });
        }
      }
      if (effect.relay) landed.push({ target: effect.relay.target, id: 'sangrado', text: '¡Relevo!', detail: `Sangrado ×${effect.relay.stacks}` });
      // Anna's Sopeta also feeds the whole table: each friend's PV back, a beat after her blow.
      effect.soothed?.forEach((h, i) => setTimeout(() => { if (token === generation) pop(h.target, `+${h.amount}`, 'heal', i ? '' : 'Sopeta'); }, 420 + i * 70));
      // A physical blow on someone bleeding spent it: how much harder it landed, in Sangrado's red.
      const wounds = [...effect.bled && effect.target ? [{ target: effect.target, bled: effect.bled }] : [], ...(effect.hits ?? []).flatMap(h => h.bled ? [{ target: h.target, bled: h.bled }] : [])];
      wounded = wounds.length > 0;
      // (A golpe crítico's own number already says what the wound added.)
      wounds.filter(w => !critOn(w.target)).forEach(w => setTimeout(() => { if (token === generation) pop(w.target, `+${Math.round((woundScale(w.bled, effect.skill) - 1) * 100)}%`, 'status', 'Sangrado', 'sangrado'); }, 60));
      // Whatever status landed says so on its own, in its colour, a beat after the number: ¡Quemado!, ¡Sangrado!…
      if (effect.burn && effect.target && !effect.burns) landed.push(fireSays(effect.target, effect.burn.id, effect.burn.level));
      if (effect.status && effect.target) landed.push({ target: effect.target, id: effect.status.id, text: `¡${STATUSES[effect.status.id].name}!`, detail: `× ${effect.status.stacks}` });
      // Tecnópata's: a cure or a status on the clock, seconds added to what was running, the blinding, the fire Rayo solar leaves.
      // Integral impropia's cure on the clock lands on each one it cured.
      for (const on of [effect.regen, effect.afflicted]) if (on && effect.target) for (const id of on === effect.regen && effect.cures ? effect.cures.map(c => c.target) : [effect.target]) landed.push({ target: id, id: on.id, text: `¡${TIMED[on.id].name}${on.level > 1 ? ` ${roman(on.level)}` : ''}!`, detail: `${TIMED[on.id].seconds} s` });
      if (effect.extended && effect.target) effect.extended.statuses.forEach(id => landed.push({ target: effect.target!, id, text: `+${effect.extended!.seconds} s`, detail: TIMED[id].name }));
      effect.blinded?.forEach(id => landed.push({ target: id, id: 'cegado', text: `¡${TIMED.cegado.name}!`, detail: '1 ronda' }));
      if (!sweep) effect.hits?.forEach(h => { if (h.burn) landed.push(h.burn.id === 'quemado' && h.burn.level >= COMBUSTION.level ? fireSays(h.target, 'quemado', h.burn.level) : { target: h.target, id: h.burn.id, text: `¡${TIMED[h.burn.id].name}${TIMED[h.burn.id].levels.length ? ` ${roman(h.burn.level)}` : ''}!`, detail: h.smoked ? h.burn.id === 'cegado' && effect.reaction?.id === 'vapor' ? 'El agua se va en vapor' : 'Se apaga el fuego' : '' }); });
      // Combustión: the fire at IV goes off. Its name over the one that burst, then the blast's number on every foe and the fires it raised.
      if (effect.combustion) {
        const c = effect.combustion;
        landed.push({ target: c.target, id: 'combustion', text: '¡Combustión!', detail: 'Estalla' });
        c.hits.forEach((h, i) => setTimeout(() => { if (token === generation) pop(h.target, `−${h.amount}`, 'damage', 'Combustión', undefined, 58); }, 320 + i * 80));
        c.burns.forEach((b, i) => setTimeout(() => { if (token === generation) { const says = fireSays(b.target, 'quemado', b.level); pop(b.target, says.text, 'status', says.detail || 'El fuego salta', says.id); } }, 560 + i * 80));
        c.steamed?.forEach((id, i) => setTimeout(() => { if (token === generation) pop(id, `¡${TIMED.cegado.name}!`, 'status', 'El agua se va en vapor', 'cegado'); }, 560 + i * 80));
      }
      // Reinicio: every clock on each foe back to its whole time.
      // Rayo de energía does it on one: what started over, by name.
      effect.restarted?.forEach(r => landed.push({ target: r.target, id: 'reinicio', text: effect.skill === 'reinicio' ? 'Reinicio' : r.statuses.length > 1 ? 'Vuelven a empezar' : 'Vuelve a empezar', detail: r.statuses.map(id => TIMED[id].name).join(' · ') }));
      if (effect.exploded) landed.push({ target: effect.actor, id: 'explosion', text: 'Pierde su turno', detail: 'Bip se recompone' });
      if (effect.charging) landed.push({ target: effect.charging, id: 'carga', text: '¡Cargado!', detail: 'Sale al empezar la ronda' });
      if (effect.stalking) landed.push({ target: effect.stalker ?? effect.actor, id: 'acecho', text: 'Al acecho', detail: effect.dual ? 'Cargado: salta al empezar la ronda' : 'Salta al empezar la ronda' });
      if (effect.pounceDual?.half && effect.target) landed.push({ target: effect.target, id: 'cargado', text: 'Sin carga', detail: 'El golpe, a la mitad' });
      effect.ward?.forEach(id => landed.push({ target: id, id: 'siete-vidas', text: 'Siete vidas', detail: 'El golpe mortal, en cura' }));
      waterSays(effect).forEach(l => landed.push(l));
      if (!sweep) effect.hits?.forEach(h => { if (h.status) landed.push({ target: h.target, id: h.status.id, text: `¡${STATUSES[h.status.id].name}!`, detail: `× ${h.status.stacks}` }); });
      // What the element turned: what it leaves, in its colour, and any PV it takes, on top of the blow's own number.
      const reaction = effect.reaction;
      // A skill on everyone says each foe's own (above): only a reaction on one target says it here.
      if (reaction?.targets && (reaction.id === 'veneno' || reaction.id === 'cristal')) {
        for (const id of reaction.targets) landed.push(reaction.id === 'veneno'
          ? { target: id, id: 'envenenado', text: `¡${TIMED.envenenado.name}${(state.foes.find(f => f.id === id)?.timed?.envenenado?.level ?? 1) > 1 ? ` ${roman(state.foes.find(f => f.id === id)!.timed!.envenenado!.level)}` : ''}!`, detail: 'El agua corre el polvo' }
          : { target: id, id: 'cristalizado', text: `¡${TIMED.cristalizado.name}!`, detail: 'El polvo se hace esquirlas' });
      } else if (reaction && effect.target && !effect.hits?.some(h => h.smoked)) {
        const says = reactionSays(reaction);
        landed.push({ target: effect.target, ...says });
        reaction.hits?.forEach((h, i) => setTimeout(() => { if (token === generation) pop(h.target, `−${h.amount}`, 'damage', says.text.replace(/[¡!]/g, ''), undefined, 58); }, 140 + i * 90));
      }
      // A blow on someone poisoned or full of shards: what it added, once for each of them.
      for (const id of new Set(effect.amplified?.map(a => a.target))) {
        const on = effect.amplified!.filter(a => a.target === id), shards = on.reduce((sum, a) => sum + (a.shards ?? 0), 0);
        if (on.some(a => a.venom)) landed.push({ target: id, id: 'envenenado', text: `Veneno +${Math.round((POWDER_RULES.poison - 1) * 100)} %`, detail: '' });
        if (shards) landed.push({ target: id, id: 'cristalizado', text: `Esquirlas +${shards}`, detail: 'Cada golpe se clava más' });
      }
      // The model: water that leaves someone Mojado, a spark that ran through the wet, and what a blow did to the boss's Error.
      effect.wetted?.forEach(id => landed.push({ target: id, id: 'mojado', text: `¡${TIMED.mojado.name}!`, detail: state!.foes.some(f => f.id === id) ? 'Se enciende' : '' }));
      if (effect.conducted && effect.target) landed.push({ target: effect.target, id: 'conduccion', text: '¡Conducción!', detail: 'Corre por el agua' });
      // El Átomo's fire: a burn on whoever was dry, Vapor on whoever was wet.
      effect.burnt?.forEach(id => landed.push({ target: id, id: 'quemado', text: `¡${TIMED.quemado.name}!`, detail: '' }));
      effect.steamed?.forEach(id => landed.push({ target: id, id: 'cegado', text: `¡${TIMED.cegado.name}!`, detail: 'El agua se va en vapor' }));
      // Cortocircuito: a move announced has to wait; on a foe it shorted last time, nothing.
      // Its own pop says the turn is lost, so no ¡Shock! on top of it.
      if (effect.shorted?.why === 'anuncio') landed.push({ target: effect.shorted.target, id: 'shock', text: '¡Cortocircuito!', detail: `Pierde su turno: ${effect.shorted.move} espera` });
      else if (effect.shorted?.why === 'mojado') landed.push({ target: effect.shorted.target, id: 'shock', text: '¡Cortocircuito!', detail: 'Pierde su siguiente turno' });
      else if (effect.shorted?.why === 'again') landed.push({ target: effect.shorted.target, id: 'shock', text: 'Aguanta', detail: 'Aún no se ha repuesto' });
      effect.shocked?.filter(id => !(effect.shorted && effect.shorted.target === id)).forEach(id => landed.push({ target: id, id: 'shock', text: '¡Shock!', detail: 'Pierde su siguiente turno' }));
      // ∂Q/∂t Condensador: the charge stored, or let go on this blow.
      if (effect.capacitor === 'stored') landed.push({ target: effect.actor, id: 'cargado', text: '¡Cargado!', detail: 'Su siguiente golpe eléctrico, el doble' });
      if (effect.capacitor === 'spent' && effect.target) landed.push({ target: effect.target, id: 'cargado', text: '×2', detail: 'Suelta la carga' });
      // Superficie mínima: the film burst on whoever struck through it, and its water landed on them a moment later
      // (Envenenado shows as the powder's reaction, unless the foe's own action already carried one).
      effect.film?.filter(f => f.left !== 'envenenado' || effect.reaction?.id !== 'veneno').forEach(f => setTimeout(() => { if (token === generation) pop(f.target, `¡${TIMED[f.left].name}!`, 'status', f.left === 'cegado' ? 'El agua apaga el fuego' : 'La película estalla', f.left); }, 380));
      // A foe struck whoever carried it: the charge jumps back, a beat after the blow.
      if (effect.discharge) { const d = effect.discharge; setTimeout(() => { if (token === generation) pop(d.target, `−${d.amount}`, 'damage', 'La carga salta'); }, 420); }
      // Arco voltaico's charge jumping (after Gerard's own, if the blow found that too), then what its bolt turned on
      // that foe, a beat after it (Plasma, Conducción, Tormenta…).
      if (effect.arcDischarge) {
        const d = effect.arcDischarge, later = effect.discharge ? 280 : 0;
        setTimeout(() => { if (token === generation) pop(d.target, `−${d.amount}`, 'damage', 'La carga salta', undefined, later ? 40 : 0); }, 420 + later);
        d.reaction?.hits?.forEach((h, i) => setTimeout(() => { if (token === generation && h.amount) pop(h.target, `−${h.amount}`, 'damage', REACTION_SAID[d.reaction!.id] ?? '', undefined, i * 16); }, 700 + later + i * 80));
      }
      const boss = effect.error || effect.converged || effect.diverged ? state.foes.find(f => f.kind === 'no-converge') : undefined;
      if (boss && effect.converged) setTimeout(() => { if (token === generation) pop(boss.id, '¡Converge!', 'status', 'Sólido: recibe el doble', 'converge'); }, 420);
      else if (boss && effect.diverged) setTimeout(() => { if (token === generation) pop(boss.id, 'Diverge', 'status', `Error ${effect.error?.left ?? boss.error ?? 0}`, 'error'); }, 420);
      else if (boss && effect.error) setTimeout(() => { if (token === generation) pop(boss.id, effect.error!.mark === 'off' ? 'Error −1' : 'Error +1', 'status', effect.error!.mark === 'off' ? `Quedan ${effect.error!.left}` : 'Se lo traga', 'error'); }, 420);
      // Control remoto: the foe it took says so, and the one it turned on takes the blow a moment later.
      if (effect.controlled && effect.target) {
        const { victim, amount } = effect.controlled;
        landed.push({ target: effect.target, id: 'confusion', text: '¡Controlado!', detail: 'Olvida su plan' });
        setTimeout(() => { if (token === generation) pop(victim, `−${amount}`, 'damage', 'Control remoto'); }, 540);
      }
      effect.cleared?.forEach(id => landed.push({ target: effect.target!, id, text: `Sin ${TIMED[id].name}`, detail: '' }));
      // Sincopante: an eco called rises over the party, Crescendo raises them, Tutti's last notes land a moment after its
      // plate, an eco at someone's side repeats their blow, and Da capo fills everyone's maná.
      if (effect.ecoCalled) landed.push({ target: effect.ecoCalled.owner, id: 'compas', text: effect.ecoCalled.kind === 'acompanamiento' ? 'Acompañamiento' : 'Eco', detail: `${ECOS.life} s` });
      if (effect.ecosRaised?.length) landed.push({ target: effect.actor, id: 'compas', text: 'Crescendo', detail: effect.ecosRaised.map(r => GRADE_NAMES[r.grade]).join(' · ') });
      effect.tutti?.forEach((last, i) => last.hits.forEach((h, j) => setTimeout(() => { if (token === generation && h.amount) pop(h.target, `${h.heal ? '+' : '−'}${h.amount}`, h.heal ? 'heal' : 'damage', 'Eco · última nota', undefined, j * 16); }, 1300 + i * 120)));
      effect.accompanied?.hits.forEach((h, i) => setTimeout(() => { if (token === generation && h.amount) pop(h.target, `−${h.amount}`, 'damage', 'Acompañamiento', undefined, i * 16); }, 560 + i * 60));
      if (effect.dacapo) for (const ally of state!.allies.filter(a => a.hp > 0)) landed.push({ target: ally.id, id: 'compas', text: '¡Da capo!', detail: effect.dacapo.duals.length ? 'Maná lleno · dúos de nuevo' : 'Maná lleno' });
      // A cure on the whole party (Integral, Bombeo): each one's PV back, a beat apart.
      effect.cures?.slice(1).forEach((c, i) => setTimeout(() => { if (token === generation) pop(c.target, `+${c.amount}`, 'heal', SKILLS.find(sk => sk.id === effect.skill)?.name ?? 'Integral'); }, 140 + i * 90));
      // Atractor extraño: what came to its target, named over it; then what met there, each with its word and the PV it took.
      if (effect.gathered && effect.target) {
        const into = state.foes.find(f => f.id === effect.target);
        const names = [...new Set(effect.gathered.flatMap(g => g.ids))].filter(id => into?.timed?.[id]).map(id => `${TIMED[id].name}${TIMED[id].levels.length && into!.timed![id]!.level > 1 ? ` ${roman(into!.timed![id]!.level)}` : ''}`);
        landed.push({ target: effect.target, id: 'atractor', text: 'Atractor', detail: names.join(' · ') || 'Todo se junta' });
        const MET = { humo: { id: 'cegado', text: '¡Humo!', detail: 'El agua apaga el fuego' }, vapor: { id: 'cegado', text: '¡Vapor!', detail: 'El agua se va en vapor' }, estallido: { id: 'quemado', text: '¡Estallido!', detail: 'El polvo arde de golpe' }, veneno: { id: 'envenenado', text: `¡${TIMED.envenenado.name}!`, detail: 'El agua corre el polvo' } } as Partial<Record<string, { id: string; text: string; detail: string }>>;
        // What met, each a step higher than the one before, so they read one under another and never on top.
        effect.gathered.flatMap(g => g.reactions).forEach((r, i) => setTimeout(() => {
          if (token !== generation) return;
          const says = MET[r.id];
          if (says) pop(effect.target!, says.text, 'status', says.detail, says.id, 0, 52 * (i + 1));
          r.hits?.forEach((h, j) => setTimeout(() => { if (token === generation) pop(h.target, `−${h.amount}`, 'damage', says?.text.replace(/[¡!]/g, '') ?? '', undefined, h.target === effect.target ? -70 : 0); }, 140 + j * 90));
        }, 520 + i * 300));
      }
      // Virus atómico: what spread, over each foe it reached.
      effect.spread?.forEach(sp => sp.to.forEach((id, i) => setTimeout(() => { if (token === generation) pop(id, '¡Contagio!', 'status', sp.statuses.join(' · '), 'virus'); }, 480 + i * 80)));
      // Escudo de bits: raised, what it stopped, and the blow that broke it.
      if (effect.bits?.raised) for (const ally of state!.allies.filter(a => a.hp > 0)) landed.push({ target: ally.id, id: 'bits', text: '¡Escudo de bits!', detail: `${effect.bits.raised} PV` });
      if (effect.bits?.took && effect.target) landed.push({ target: effect.target, id: 'bits', text: effect.bits.broke ? '¡Cúpula rota!' : `Cúpula −${effect.bits.took}`, detail: effect.bits.broke ? 'El resto pasa' : 'Para el golpe' });
      if (effect.bits?.mended && effect.target) landed.push({ target: effect.target, id: 'bits', text: `Cúpula +${effect.bits.mended}`, detail: 'Se recompone' });
      // Vulcano: the volcano under each of them.
      // The newer duals: what each leaves, named over whoever carries it.
      if (effect.left) for (const id of effect.left.targets) {
        // Electrólisis's gas says its level: the water it was made of.
        const level = effect.gas?.find(g => g.target === id)?.level;
        landed.push({ target: id, id: effect.left.id, text: `¡${TIMED[effect.left.id].name}${level ? ` ${roman(level)}` : ''}!`, detail: DUAL_LEFT[effect.left.id] ?? `${TIMED[effect.left.id].seconds} s` });
      }
      // The gas goes up: its name over the one the fire found, then each blast as the front reaches it, and the fire it leaves.
      if (effect.ignited) {
        const g = effect.ignited;
        landed.push({ target: g.from, id: 'gas', text: '¡El gas estalla!', detail: g.hits.length === 1 ? 'Estalla en uno' : `Estalla en ${g.hits.length}` });
        g.hits.forEach((h, i) => setTimeout(() => { if (token === generation) pop(h.target, `−${h.amount}`, 'damage', `Gas ${roman(h.level)}`, undefined, 58); }, 260 + i * IGNITION_GAP * 1000));
        // A fire the blow itself already said (Foc Binari's Quemado on the one it struck) is not said twice.
        const told = new Set([...effect.burn?.id === 'quemado' && effect.target ? [effect.target] : [], ...effect.reaction?.burns?.map(b => b.target) ?? [], ...(effect.hits ?? []).filter(h => h.burn?.id === 'quemado').map(h => h.target)]);
        g.burns.filter(b => !told.has(b.target)).forEach((b, i) => setTimeout(() => { if (token === generation) { const says = fireSays(b.target, 'quemado', b.level); pop(b.target, says.text, 'status', says.detail || 'El gas lo prende', says.id); } }, 520 + i * IGNITION_GAP * 1000));
        g.steamed?.forEach((id, i) => setTimeout(() => { if (token === generation) pop(id, `¡${TIMED.cegado.name}!`, 'status', 'El agua se va en vapor', 'cegado'); }, 520 + i * 80));
      }
      if (effect.vapour) for (const id of effect.vapour) landed.push({ target: id, id: 'cegado', text: 'Vapor', detail: TIMED.cegado.name });
      if (effect.mirrored) landed.push({ target: effect.mirrored.target, id: 'bits', text: `Caleidoscopio −${effect.mirrored.amount}`, detail: 'Devuelve el golpe' });
      if (effect.fooled) landed.push({ target: effect.fooled, id: 'confusion', text: '¡Trampantojo!', detail: `${TIMED.confusion.name} · 20 s` });
      if (effect.dual?.id === 'suceso-seguro') for (const ally of state!.allies.filter(a => a.hp > 0)) landed.push({ target: ally.id, id: 'racha', text: 'Suceso seguro', detail: 'Crítico seguro' });
      if (effect.dual?.id === 'trampantojo' && effect.target) landed.push({ target: effect.target, id: 'cortina', text: 'Trampantojo', detail: 'Confunde a quien la rompa' });
      if (effect.dual?.id === 'vulcano') effect.hits?.forEach(h => { if (state!.foes.find(f => f.id === h.target)?.timed?.volcan) landed.push({ target: h.target, id: 'volcan', text: '¡Volcán!', detail: '20 s' }); });
      // A passive that did something: its name on a plate over whoever has it, in their ánima's colour.
      effect.passives?.forEach((p, i) => setTimeout(() => {
        if (token !== generation) return;
        const el = pop(p.who, p.name, 'passive', effect.mana && p.id === 'toma-de-tierra' ? `Pasiva · Maná +${effect.mana}` : 'Pasiva');
        el?.style.setProperty('--anima', CLASSES[PASSIVES[p.id].anima].colour);
        callbacks.sound('mark-set');
      }, 380 + i * 260));
      // The blow's element found what the foe is made of: said on the blow, and kept on the plate from now on.
      const element = effect.element ?? elementOf(effect.skill ? SKILLS.find(sk => sk.id === effect.skill) : undefined) ?? elementOf(DUALS.find(d => d.id === (effect.dual?.id ?? effect.release?.id)));
      const affinities: [string, Affinity][] = [...effect.affinity && effect.target ? [[effect.target, effect.affinity] as [string, Affinity]] : [], ...(effect.hits ?? []).filter(h => h.affinity).map(h => [h.target, h.affinity!] as [string, Affinity])];
      if (element) for (const [id, a] of affinities) {
        const kind = state!.foes.find(f => f.id === id)?.kind;
        if (kind) foundAffinities.set(kind, new Set([...foundAffinities.get(kind) ?? [], element]));
        landed.push({ target: id, id: `${a === 'weak' ? 'debil' : 'resiste'}-${element}`, text: a === 'weak' ? '¡Débil!' : 'Resiste', detail: `${ELEMENTS[element].name} ×${ELEMENT_RULES[a]}` });
      }
      // The kind of blow found it (a dish, a mago, glass, rancid gum): said the same way, with no number, since each has its own.
      const byElement = new Set(element ? affinities.map(([id]) => id) : []);
      for (const k of effect.kinds ?? []) if (!byElement.has(k.target)) landed.push({ target: k.target, id: `${k.affinity === 'weak' ? 'debil' : 'resiste'}-${k.blow === 'physical' ? 'fisico' : 'magico'}`, text: k.affinity === 'weak' ? '¡Débil!' : 'Resiste', detail: k.blow === 'physical' ? 'Golpe físico' : 'Magia' });
      // Punto débil: left on the target, or spent by this blow (it landed WEAK_SPOT times as hard).
      const spentOn = [...markSpent(effect) && effect.target && !effect.hits ? [effect.target] : [], ...(effect.hits ?? []).filter(h => h.weakSpot).map(h => h.target)];
      if (markLeft(effect) && effect.target) landed.push({ target: effect.target, id: 'punto-debil', text: '¡Punto débil!', detail: `×${WEAK_SPOT} al siguiente golpe` });
      spentOn.forEach(id => landed.push({ target: id, id: 'punto-debil', text: `×${WEAK_SPOT}`, detail: 'Punto débil' }));
      if (!strikes) stamp();
      iceBreaks(effect, token);
    });
    // A blow the scene never got to (the fight cut short) still comes off.
    if (owed.size || heldFire.size || unlanded) { owed.clear(); heldFire.clear(); unlanded = false; released.clear(); if (token === generation && state) render(); }
    if (token === generation) { delete root.dataset.resolving; delete root.dataset.actor; }
  }
  /**
   * The confirm: the action goes off at once (`run`). With two players each confirms on their own:
   * one confirmed while another action plays waits for it (`pending`), in the order confirmed. A dual
   * between them goes off once both have picked the same foe (`duo`). Once the party is through,
   * the foes act and the round ends.
   */
  async function execute(target?: string) {
    if (!state || !selected || locked()) return;
    if ((selected === 'attack' || selected === 'dual' || (selected === 'skill' && (!selectedSkill || aimed(selectedSkill)))) && !targeting) return;
    // Split, a plate or a card can be lit for the other player's move: picked for this one, it is not theirs to take.
    if (targeting && target && !ownTargets().includes(target)) { callbacks.sound('denied'); return; }
    // A skill with no target confirmed on a plate (split, `beginTargeting`) still goes to everyone.
    if (selected === 'skill' && selectedSkill && !aimed(selectedSkill)) target = undefined;
    const me = split() ? allyOf(ctx)! : state.allies[state.active];
    const named = (id?: string) => [...state!.allies, ...state!.foes].find(c => c.id === id)?.name;
    let job: Job;
    if (duo && selected === 'dual') {
      duo.aims[ctx] = target;
      const mine = duo.aims[ctx], theirs = duo.aims[other(ctx)], spec = DUALS.find(d => d.id === duo!.id)!;
      callbacks.sound('ui-confirm');
      // On one fighter both pick the same one; on every foe or the whole party it is enough that both confirm.
      if (!mine || !theirs || (dualSingle(spec) && mine !== theirs)) { render(); return; }
      job = { player: ctx, ally: me.id, command: 'dual', dual: spec.id, die: duo.die, target, text: dualText(spec, target) };
      duo = undefined;
      withPlayer(other(ctx), () => collapse());
    } else if (selected === 'dual') {
      const spec = DUALS.find(d => d.id === selectedDual);
      if (!spec) return;
      job = { player: ctx, ally: me.id, command: 'dual', dual: spec.id, target, text: `${spec.name} → ${named(target) ?? ''}` };
    } else {
      job = (selected === 'skill' && selectedSkill ? chanceDual(selectedSkill, target) : undefined)
        ?? { player: ctx, ally: me.id, command: selected, skill: selectedSkill, die: selectedDie, target, text: queuedText({ action: selected as Queued['action'], skill: selectedSkill, target }, me) };
    }
    // Against La Voz the press is what counts: a blow pressed in her silence lands there, even if it plays behind the partner's.
    if (state.song) job.at = state.song.t;
    pending.push(job);
    collapse(); render();
    if (!busy) await run();
  }
  /** Plays whatever has been confirmed, one after another, then the foes' turn if the party is through. */
  async function run() {
    if (!state || busy) return;
    const token = generation;
    busy = true; stale = undefined; render();
    // The tempo (battle-motion `holdAfter`): before anyone else moves, what this action changed gets
    // its moment on screen (a fire lit, stats down, someone falling); otherwise only a short breath.
    const down = (e: BattleEffect) => !!e.target && [...state!.allies, ...state!.foes].some(c => c.id === e.target && c.hp === 0);
    const breath = (e?: BattleEffect) => e ? wait(holdAfter(e, down(e), repeatedDuals.has(e))) : Promise.resolve();
    let last: BattleEffect | undefined;
    while (token === generation && state && state.phase === 'player' && pending.length) {
      if (last) { await breath(last); if (token !== generation || !state) return; }
      const job = pending.shift()!;
      if (state.song && job.at !== undefined) state.song.aim = job.at;
      const effect = holdBack(() => !takeTurn(state!, job.ally) ? undefined
        : job.command === 'dual' ? actDual(state!, job.dual!, job.target, job.die)
        : split() ? act(state!, job.command as BattleAction, job.target, job.skill, job.die) : commit(state!, job.command as BattleAction, job.target, job.skill, job.die));
      if (state.song) delete state.song.aim;
      // It could no longer be (its target fell, no maná): that player chooses again.
      if (!effect) { stale = job.ally; render(); continue; }
      render();
      last = effect;
      await play(effect, token);
      if (token !== generation || !state) return;
      await flushNews(token);
    }
    if (token !== generation || !state) return;
    // Round after round while nobody in the party can choose (Explosión: Aitor sits one out with Gerard down).
    while (state.phase === 'enemy') {
      const [plan] = await Promise.all([planEnemyTurn(state), breath(last)]);
      if (token !== generation || !state) return;
      // Each foe standing, in order, once (a part, Vertitrón's eye, has no turn).
      const tried = new Set<string>();
      for (;;) {
        // A fire may have ended the fight while the foes were acting.
        if ((state.phase as BattleState['phase']) !== 'enemy') break;
        const foe = state.foes.find(f => f.hp > 0 && !tried.has(f.id) && !state!.enemyActions.includes(f.id));
        if (!foe) break;
        tried.add(foe.id);
        // Holding Aitor, her turn is his: player 2 picks what he does to Gerard (docs/castle-bosses.md § Aitor, held).
        const held = heldAitor(foe);
        if (held) {
          const move = await chooseHeld(held, token);
          if (token !== generation || !state) return;
          state.castle!.aitorMove = move;
        }
        const response = holdBack(() => enemyAct(state!, foe.id, plan[foe.id]));
        if (response) await play(response, token);
        if (token !== generation || !state) return;
        if (response) await wait(holdAfter(response, down(response), repeatedDuals.has(response)));
        if (token !== generation || !state) return;
        await flushNews(token);
        if (token !== generation || !state) return;
      }
      // enemyAct may have stopped the fight for the palace beat (TypeScript still thinks it is 'enemy').
      if ((state.phase as BattleState['phase']) === 'beat') await playBeat(token);
      if (token !== generation || !state) return;
      const before = snapshot(), ticks = nextRound(state);
      // A charged dual went off as the round started (Rayo solar): what it did waits for its news to play it.
      const release = state.news?.find(news => news.release || news.detonation || news.pounce);
      if (release) holdFrom(before, release); else void callbacks.change(state);
      queueMenu = undefined; stale = undefined;
      if (ticks.length) {
        // The round's end: what keeps hurting hurts now, one after another.
        render();
        for (const tick of ticks) {
          if (tick.saved) { livesPop(tick.target, tick.saved); await wait(900); continue; }
          callbacks.sound('bleed'); pop(tick.target, `−${tick.amount}`, 'damage', STATUSES[tick.status].name); await wait(380);
        }
        if (token !== generation || !state) return;
      }
      await flushNews(token);
      if (token !== generation || !state) return;
    }
    busy = false; render();
    // Someone confirmed while the last one played: theirs goes now.
    if (pending.length && state.phase === 'player') { await run(); return; }
    if (state.phase === 'player') for (const p of [1, 2] as PlayerId[]) withPlayer(p, () => { if (!selected && canAct(state!.allies[state!.active])) focusFirst(); });
  }
  /**
   * The last scene (`callbacks.lastScene`): every part of the fight's HUD goes but the lines said in
   * it, what is outside the fight (the two commands) can be reached, and the fight closes after.
   */
  async function playLast() {
    const token = generation;
    root.dataset.finale = 'true'; collapse();
    outside().forEach(el => { el.inert = false; });
    try { await callbacks.lastScene!((speaker, text, ms) => speak({ speaker, text }, ms)); }
    finally { if (token === generation) { delete root.dataset.finale; close(); } }
  }
  /** The fight as it was opened, to fight it again from the start (`close('retry')`). */
  let reopen: (() => void) | undefined;
  /** Ends the fight; after a fall, `retry` opens it again from the start and `rewind` leaves it as if it never began. */
  function close(after?: 'retry' | 'rewind') {
    const again = after === 'retry' ? reopen : undefined;
    if (after) callbacks.fallen?.(after);
    // A card left open goes with the fight, unread: it shows again next time.
    guideOpen = undefined; delete root.dataset.guide; root.querySelector<HTMLElement>('.guide-card')!.hidden = true; onPlates.clear();
    holdOn?.done();
    generation++; state = undefined; busy = false; summaryOpen = false; queueMenu = undefined; firing = undefined; stale = undefined; slowUntil = 0; get('.dual-banner').hidden = true; get('.dual-cinema').hidden = true; clearTimeout(calloutTimer); get('.move-callout').hidden = true; renderSummary(); collapse(); root.hidden = true; cancelAnimationFrame(clockFrame); resetRewards();
    outside().forEach(el => { el.inert = false; }); delete hud.dataset.battle;
    const ended = callbacks.change(undefined);
    if (again) void ended.then(again);
    (previousFocus?.isConnected && !previousFocus.hidden ? previousFocus : document.querySelector<HTMLElement>('#game'))?.focus({ preventScroll: true });
  }
  root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!target) return;
    // A guide card holds the fight: only its own button answers.
    if (guideOpen) { if (target.matches('.guide-card-ok')) closeGuide(); return; }
    // Something new holds the screen: any click goes on (`holdUntilConfirm`).
    if (holdOn) { releaseHold(); return; }
    // A level reached holds the way out until it has all shown (`settleRewards`).
    if (target.closest('.battle-result')) { if (holdingRewards()) return; const after = target.dataset.after; close(after === 'retry' || after === 'rewind' ? after : undefined); return; }
    if (target.matches('.summary-key')) { toggleSummary(); return; }
    // A move ready ahead in a partner's dock: only that partner's player picks it (the mouse is player 1).
    const queueDock = target.closest<HTMLElement>('.queue-panel, .queue-plate')?.closest<HTMLElement>('.battle-dock');
    if (queueDock) {
      const owner = ownerOf(queueDock);
      if (!owner || callbacks.driver(owner.id) !== pointerPlayer || !state) return;
      if (target.matches('.queue-cancel')) unqueue(owner);
      else if (target.dataset.queue !== undefined && queueMenu?.ally === owner.id) { queueMenu.cursor = Number(target.dataset.queue); queuePick(owner); }
      return;
    }
    // Mouse and keyboard belong to player 1, a controller's confirm to its player (`control`): each only in their own dock.
    if (!split()) { if (turnDriver() !== pointerPlayer || busy) return; clickIn(target); return; }
    // A fighter's card stands in their player's dock, yet anyone may aim at it (a cure for the partner):
    // only the dock's own commands are its player's.
    const dock = target.closest<HTMLElement>('.battle-dock');
    if (dock && !target.matches('[data-target]') && Number(dock.dataset.dock) !== pointerPlayer) return;
    withPlayer(pointerPlayer, () => { if (!locked()) clickIn(target); });
  });
  function clickIn(target: HTMLButtonElement) {
    if (target.matches('.command-back, .target-back')) { back(); return; }
    if (target.matches('.anima-key')) { changeAnima(Number(target.dataset.step) as -1 | 1); return; }
    if (target.dataset.anima) { changeAnima(target.dataset.anima as ClassId); return; }
    if (target.dataset.skill) { beginTargeting(target.dataset.skill as SkillId); return; }
    if (target.dataset.die !== undefined && pickingDie) {
      // A die that can do nothing now stays in the hand.
      if (target.getAttribute('aria-disabled') === 'true') { callbacks.sound('ui-back'); return; }
      selectedDie = Number(target.dataset.die); beginTargeting(pickingDie); return;
    }
    if (target.dataset.dual) { chooseDual(target.dataset.dual as DualId); return; }
    if (target.dataset.element !== undefined) {
      if (state && chooseElement(state, state.allies[state.active], (target.dataset.element || undefined) as AttackElement | undefined)) { elementLearned = true; callbacks.sound('ui-move'); render(); }
      return;
    }
    if (target.matches('.command-trigger')) choose(target.closest<HTMLElement>('[data-command]')!.dataset.command as Command);
    else if (target.matches('[data-target], [data-confirm]')) void execute(target.dataset.target);
  }
  root.addEventListener('focusin', event => {
    if (event.target instanceof HTMLElement && event.target.parentElement?.classList.contains('skill-list')) keepInView(event.target);
    // Dadista: the die under the cursor comes forward beside its wearer.
    if (event.target instanceof HTMLElement && event.target.dataset.die !== undefined && state) callbacks.aimDie?.(state.allies[state.active].id, Number(event.target.dataset.die));
    if (details) placeDetails();
  });
  {
    const list = get('.skill-list');
    // The details box follows its skill once the list has slid.
    list.addEventListener('scrollend', () => { if (details) placeDetails(); });
    // The wheel (or a trackpad) walks the skills a step at a time, as the arrows do.
    let wheeled = 0;
    list.addEventListener('wheel', event => {
      if (!list.dataset.window) return;
      event.preventDefault();
      const now = performance.now();
      if (Math.abs(event.deltaY) < 4 || now - wheeled < 140) return;
      wheeled = now;
      const rows = skillButtons(), at = rows.indexOf(cursor()!);
      focusOn(rows[Math.max(0, Math.min(rows.length - 1, (at < 0 ? Number(list.dataset.start ?? 0) : at) + Math.sign(event.deltaY)))]);
    }, { passive: false });
  }
  // The queue never takes the page's focus (it belongs to whoever's turn it is), not even on a click.
  root.addEventListener('mousedown', event => { if ((event.target as HTMLElement).closest('.queue-panel, .queue-plate')) event.preventDefault(); });
  // The mouse is player 1's: split, it aims Gerard's move whenever he is choosing one.
  for (const eventName of ['pointerover', 'focusin']) root.addEventListener(eventName, event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-target]');
    if (!button || button.disabled) return;
    // Split, the other player's cure lights the cards up too: Gerard's attack never moves onto them.
    const aim = () => { if (targeting && !locked() && ownTargets().includes(button.dataset.target!)) highlight(button.dataset.target); };
    if (state && split()) withPlayer(1, aim, true); else if (!busy) aim();
  });
  /** Who the click being handled comes from: the mouse and keyboard, unless `control` is pressing for a controller. */
  let pointerPlayer: PlayerId = 1;
  function keydown(event: KeyboardEvent) {
    if (!state || finale || event.metaKey || event.ctrlKey || event.altKey) return;
    // A guide card holds the fight: Enter, Space or Escape close it, and nothing else reaches the fight.
    if (guideOpen) {
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat && ['Enter', ' ', 'Escape'].includes(event.key)) closeGuide();
      return;
    }
    if (holdOn) {
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat && ['Enter', ' '].includes(event.key)) releaseHold();
      return;
    }
    // Aitor held, played from the keyboard (alone, or with no second pad): its arrows and Enter.
    if (heldChoice && heldDriver() === 1) {
      const action = ({ ArrowUp: 'up', ArrowDown: 'down', Enter: 'confirm', ' ': 'confirm' } as Record<string, ControlAction>)[event.key];
      if (action) { event.preventDefault(); event.stopPropagation(); heldControl(action); }
      return;
    }
    // The summary is anyone's to open and close, at any moment (R, or Esc while it is open).
    if ((event.code === 'KeyR' && !event.repeat) || (event.key === 'Escape' && summaryOpen)) { event.preventDefault(); event.stopPropagation(); toggleSummary(event.code === 'KeyR' ? undefined : false); return; }
    const over = ['won', 'lost', 'escaped'].includes(state.phase);
    // The keyboard is player 1's: split, it works their menu whenever Gerard can choose; alone, on its turn.
    if (!over && split()) { withPlayer(1, () => { if (!locked()) keyIn(event); }); event.preventDefault(); event.stopPropagation(); return; }
    if (!over && (turnDriver() !== 1 || busy)) { event.preventDefault(); event.stopPropagation(); return; }
    keyIn(event);
  }
  // ——— Aitor held: player 2 plays her side ————————————————————————————————————————————
  /** Whom the Queen holds, if this foe is her and her turn is theirs to play now (not lost to the artilugio's first note). */
  function heldAitor(foe: Combatant) {
    if (!state || foe.kind !== 'reina' || foe.castle?.stage !== 'aitor' || foe.castle?.stunned) return undefined;
    return state.allies.find(a => a.castle?.held === 'reina' && a.hp > 0);
  }
  let heldChoice: { moves: HeldMove[]; at: number; done: (move: HeldMove) => void; panel: HTMLElement } | undefined;
  /** Who plays him: his own driver (player 2), or player 1 alone or while player 2 has no pad. */
  const heldDriver = (): PlayerId => callbacks.waiting('aitor') ? 1 : callbacks.driver('aitor');
  /**
   * Aitor's commands on her side, on the right of the screen, in possession's violet: Atacar, his
   * skills aimed at a foe (Gerard, for him now) that he can pay for, Defender. Whatever he picks, the
   * thread makes him hurt Gerard (src/castle-fight.ts).
   */
  function chooseHeld(held: Combatant, token: number) {
    return new Promise<HeldMove>(resolve => {
      const moves = heldMoves(state!, held);
      const panel = document.createElement('section');
      panel.className = 'held-menu';
      panel.dataset.glyphPlayer = String(heldDriver());
      const label = (move: HeldMove) => move.action === 'attack' ? 'Atacar' : move.action === 'defend' ? 'Defender' : SKILLS.find(s => s.id === move.skill)?.name ?? move.skill!;
      panel.innerHTML = `<p class="held-kicker">AITOR · SUYO</p><h2>Contra ${escapeHtml(state!.allies.find(a => a !== held && a.hp > 0)?.name ?? 'Gerard')}</h2>`
        + `<ol>${moves.map((move, i) => `<li><button type="button" data-held="${i}">${escapeHtml(label(move))}${move.action === 'skill' ? `<small>${SKILLS.find(s => s.id === move.skill)?.cost ?? ''} maná</small>` : ''}</button></li>`).join('')}</ol>`
        + `<p class="held-hint" data-glyph-template="{updown} Elegir · {confirm} Confirmar"></p>`;
      root.append(panel);
      const finish = (move: HeldMove) => { panel.remove(); heldChoice = undefined; render(); resolve(move); };
      heldChoice = { moves, at: 0, done: finish, panel };
      panel.addEventListener('click', event => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-held]');
        if (button && heldChoice) finish(heldChoice.moves[Number(button.dataset.held)]);
      });
      showHeld();
      // A fight closed meanwhile leaves nobody to choose: let the turn go.
      const watch = () => { if (token !== generation && heldChoice?.panel === panel) finish(moves[0]); else if (heldChoice?.panel === panel) requestAnimationFrame(watch); };
      requestAnimationFrame(watch);
    });
  }
  function showHeld() {
    if (!heldChoice) return;
    heldChoice.panel.querySelectorAll<HTMLButtonElement>('[data-held]').forEach((b, i) => {
      b.classList.toggle('is-cursor', i === heldChoice!.at);
      // The keys reach the fight through its focus: the cursor holds it.
      if (i === heldChoice!.at) b.focus({ preventScroll: true });
    });
  }
  function heldControl(action: ControlAction) {
    if (!heldChoice) return;
    if (action === 'up' || action === 'down') { heldChoice.at = (heldChoice.at + (action === 'up' ? -1 : 1) + heldChoice.moves.length) % heldChoice.moves.length; showHeld(); }
    else if (action === 'confirm') heldChoice.done(heldChoice.moves[heldChoice.at]);
  }
  /** A note of the artilugio (src/artilugio.ts, which also sounds it): what it did over Aitor and her. */
  function note(n: number) {
    if (!state) return;
    const done = castleNote(state, n);
    if (!done) return;
    const queen = state.foes.find(f => f.kind === 'reina'), aitor = state.allies.find(a => a.id === 'aitor');
    if (done.startled && queen) pop(queen.id, 'Se gira', 'status', 'Pierde su turno');
    if (aitor) pop(aitor.id, done.freed ? 'Libre' : done.right ? `${done.notes} de ${MELODY.length}` : 'Se apagan', done.freed ? 'heal' : done.right ? 'stat-up' : 'stat-down', done.freed ? 'Maná lleno' : '');
    render();
  }
  function keyIn(event: KeyboardEvent) {
    if (!state) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const button = cursor();
      if (!event.repeat && button) { pointerPlayer = 1; button.click(); }
    } else if (event.key === 'Tab') {
      const buttons = [...root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(b => b.tabIndex >= 0 && !b.closest('[inert], [hidden]'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'Escape') { event.preventDefault(); back(); }
    else if (/^[1-9]$/.test(event.key) && !event.repeat) {
      event.preventDefault();
      const index = Number(event.key) - 1;
      if (targeting) focusOn(targetButtons()[index]);
      else if (selected === 'skill' || selected === 'dual') skillButtons()[index]?.click();
      else if (COMMANDS[index]) choose(COMMANDS[index].id);
    }
    else if (event.key.toLowerCase() === 'i' && !event.repeat) { event.preventDefault(); showDetails(!details); }
    // The keyboard is player 1's: split, the turn may still be on the partner's fighter, whose ánima and element are not Gerard's to change.
    else if (event.key.toLowerCase() === 'x' && !event.repeat) { event.preventDefault(); withPlayer(1, () => { if (state && !locked() && state.phase === 'player' && (!selected || (selected === 'attack' && targeting))) nextElement(state.allies[state.active]); }); }
    else if (['q', 'e'].includes(event.key.toLowerCase()) && !event.repeat) { event.preventDefault(); withPlayer(1, () => changeAnima(event.key.toLowerCase() === 'q' ? -1 : 1)); }
    else if (event.key.startsWith('Arrow')) { event.preventDefault(); navigate(event.key.slice(5).toLowerCase() as Direction); }
    event.stopPropagation();
  }
  root.addEventListener('keydown', keydown);
  /**
   * Arrows, the stick and the D-pad: up and down walk the column in front of you; right on Habilidad
   * opens its flyout and left closes it again (not on the D-pad, whose sides open the summary).
   * Picking a target walks every eligible fighter.
   */
  function navigate(direction: Direction) {
    // Aitor's dock is mirrored: its skills open to the left.
    if (mirrored() && (direction === 'left' || direction === 'right')) direction = direction === 'left' ? 'right' : 'left';
    const step = direction === 'up' || direction === 'left' ? -1 : 1;
    const walk = (buttons: HTMLButtonElement[]) => {
      const visible = buttons.filter(b => !b.disabled && b.tabIndex >= 0 && !b.closest('[inert], [hidden]') && b.getClientRects().length);
      const index = visible.indexOf(cursor()!);
      focusOn(visible[index < 0 ? 0 : (index + step + visible.length) % visible.length]);
    };
    if (targeting) walk(targetButtons());
    else if (selected === 'skill' || selected === 'dual') {
      if (direction === 'left') back();
      else if (direction !== 'right') walk([...scope().querySelectorAll<HTMLButtonElement>('.skill-flyout button')]);
    } else if (direction === 'right') {
      const sheet = (['skill', 'dual'] as const).find(id => scope().querySelector(`[data-command="${id}"] .command-trigger`) === cursor());
      if (sheet) choose(sheet);
    }
    else if (direction === 'left') return;
    else walk([...scope().querySelectorAll<HTMLButtonElement>('.command-trigger'), ...root.querySelectorAll<HTMLButtonElement>('.battle-result button')]);
  }
  /**
   * Development (the picker, docs/dev-tools.md): jumps the fight to a moment. A win or a loss shows
   * its result; 1 PV leaves the next blow to decide; `beat` plays Bernat's cry and Matemágico waking now.
   */
  async function jumpTo(moment: FightMoment) {
    if (!state || busy || state.phase !== 'player') return;
    const token = generation;
    collapse();
    if (moment === 'won' || moment === 'won-level' || moment === 'lost') {
      for (const unit of moment === 'lost' ? state.allies : state.foes) unit.hp = 0;
      // Enough EXP for the ánima furthest from its next level: every one in the fight goes up.
      if (moment === 'won-level') state.extraXp = Math.max(0, Math.max(0, ...participants(state).map(p => toNextLevel(xpBefore[p.id] ?? 0, state!.levels?.[p.id] ?? 1, reachOf(p.id, levelCap)))) - fightXp({ foes: state.foes }));
      state.phase = moment === 'lost' ? 'lost' : 'won';
      state.message = moment === 'lost' ? 'Depuración: combate perdido.' : moment === 'won-level' ? 'Depuración: combate ganado, con experiencia para subir de nivel.' : 'Depuración: combate ganado.';
    } else if (moment === 'foes-low' || moment === 'party-low') {
      for (const unit of moment === 'foes-low' ? state.foes : state.allies) if (unit.hp > 0) unit.hp = 1;
    } else if (moment.startsWith('agua-')) {
      // Freática's water at will: every foe standing at that mark (`stageWater`).
      if (!stageWater(state, Number(moment.slice('agua-'.length)))) return;
    } else if (moment in STAGED_MOMENTS) {
      // Vertitrón's moments, El Plato's surprise: the fight stages them itself (`stageMoment`).
      if (!stageMoment(state, moment as StagedMoment)) return;
      queueMenu = undefined; stale = undefined;
    } else if (moment === 'beat') {
      const bernat = state.allies.find(a => a.id === 'bernat');
      if (state.encounter !== 'palace-minion' || state.awakened || !bernat) return;
      bernat.hp = Math.max(1, Math.min(bernat.hp, BEAT_HP)); state.phase = 'beat';
      busy = true; await callbacks.change(state); await playBeat(token);
      if (token !== generation || !state) return;
      busy = false;
    }
    await callbacks.change(state);
    if (token !== generation || !state) return;
    render();
    if (state.phase === 'player') focusFirst();
  }
  /**
   * Development (the ánimas' sheet's stage, `?anima-demo`, src/anima-demo.ts): one skill or dual
   * played by the fight's own rules and shown as the fight shows it (banner, callout, the scene's
   * effects, numbers, sounds), on a fight that never ends. Whoever can wear its ánima puts it on, at
   * its top level with its maná full and no limits of use (`unbound`); everyone stands again, the foes
   * with PV to spare, and the turn comes back after. Returns what was played, or why it could not be.
   */
  async function demo(move: { skill?: SkillId; dual?: DualId }): Promise<{ ok: boolean; text: string }> {
    if (!state) return { ok: false, text: 'No hay combate.' };
    if (busy || state.phase !== 'player') return { ok: false, text: 'Espera: el combate aún se mueve.' };
    const s = state, token = generation, all = Object.keys(ANIMA_NAMES) as ClassId[];
    collapse();
    s.unbound = true; s.animas = all; s.levels = Object.fromEntries(all.map(id => [id, MAX_LEVEL]));
    // Every tree's skills and every dúo mayor bought; the passives stay off, so each skill is seen as it is.
    s.improved = { ...s.improved, skills: SKILLS.filter(x => 'node' in x).map(x => x.id as SkillId), duals: DUALS.filter(d => d.major).map(d => d.id) };
    s.spent = []; delete s.queued;
    const stand = () => {
      for (const c of s.allies) { c.hp = c.maxHp; c.kit = all.filter(id => canWear(c.id, id)); }
      for (const f of s.foes) { f.maxHp = Math.max(f.maxHp, 600); f.hp = f.maxHp; }
    };
    stand();
    /** Puts `cls` on `ally`: whoever else has it on changes to another first. */
    const wear = (ally: Combatant, cls: ClassId) => {
      if (ally.classId !== cls) {
        const other = s.allies.find(a => a !== ally && a.classId === cls);
        if (other) { s.active = s.allies.indexOf(other); const spare = kitIn(s, other).find(id => id !== cls && free(s, other, id)); if (spare) wearAnima(s, spare); }
        s.active = s.allies.indexOf(ally);
        if (!wearAnima(s, cls)) return false;
      }
      ally.secondary = ally.maxSecondary;
      for (const id of Object.keys(ally.mana ?? {}) as ClassId[]) ally.mana![id] = manaMax(s.improved, id, s.levels);
      return true;
    };
    const middle = (list: Combatant[]) => list[Math.floor((list.length - 1) / 2)]?.id;
    const named = (c: Combatant) => `${c.name} con ${ANIMA_NAMES[c.classId!]}`;
    let effect: BattleEffect | undefined, text = '';
    if (move.dual) {
      const d = DUALS.find(x => x.id === move.dual);
      if (!d) return { ok: false, text: `No hay dúo ${move.dual}.` };
      const [a, b] = d.parts.map(p => SKILLS.find(x => x.id === p)!.class as ClassId);
      const [x, y] = s.allies.filter(c => c.hp > 0);
      const pair = x && y ? canWear(x.id, a) && canWear(y.id, b) ? [x, y] : canWear(y.id, a) && canWear(x.id, b) ? [y, x] : undefined : undefined;
      if (!pair) return { ok: false, text: `Nadie en el grupo puede llevar ${ANIMA_NAMES[a]} y ${ANIMA_NAMES[b]} a la vez.` };
      // The second half first, so the first's ánima is put on last and its wearer is the one acting.
      if (!wear(pair[1], b) || !wear(pair[0], a)) return { ok: false, text: 'No se pudieron poner las dos ánimas.' };
      if (d.parts.some(p => SKILLS.find(x => x.id === p)?.kind === 'heal')) for (const c of s.allies) c.hp = Math.ceil(c.maxHp / 2);
      const target = middle(dualTargets(s, d));
      takeTurn(s, pair[0].id);
      effect = holdBack(() => actDual(s, d.id, target));
      text = `${d.name} · ${named(pair[0])} y ${named(pair[1])}`;
    } else if (move.skill) {
      const spec = SKILLS.find(x => x.id === move.skill);
      if (!spec) return { ok: false, text: `No hay habilidad ${move.skill}.` };
      const cls = spec.class as ClassId;
      const who = s.allies.filter(c => canWear(c.id, cls)).sort((p, q) => Number(ANIMA_OWNERS[cls] === q.id) - Number(ANIMA_OWNERS[cls] === p.id))[0];
      if (!who || !wear(who, cls)) return { ok: false, text: `Nadie en el grupo puede llevar ${ANIMA_NAMES[cls]}.` };
      // What it needs to be there: someone hurt for a cure, the die of its face, the meteor at its size.
      if (spec.kind === 'heal') for (const c of s.allies) c.hp = Math.ceil(c.maxHp / 2);
      // Agitar is no action: the hand is thrown again and the turn goes on (`shakeHand`).
      if ('free' in spec) { takeTurn(s, who.id); shakeHand(); return { ok: true, text: `${spec.name} · ${named(who)}` }; }
      let skill = spec.id as SkillId, die: number | undefined;
      if ('face' in spec) { who.dice = [spec.face as DieFace]; skill = 'tirar-dado'; die = 0; }
      if ('meteor' in spec) who.meteor = spec.meteor as number;
      takeTurn(s, who.id);
      const targets = validTargets(s, 'skill', skill, die);
      const target = spec.side === 'allies' ? (s.allies.find(c => c !== who && targets.includes(c)) ?? targets[0])?.id : middle(targets);
      effect = holdBack(() => act(s, 'skill', target, skill, die));
      text = `${spec.name} · ${named(who)}`;
    }
    if (!effect) { const why = s.message; stand(); s.phase = 'player'; render(); return { ok: false, text: `${text || 'Eso'} no se puede ahora${why ? `: ${why}` : '.'}` }; }
    busy = true; render();
    try {
      await play(effect, token);
      if (token !== generation || !state) return { ok: false, text: 'El combate se cerró.' };
      await flushNews(token);
    } finally {
      if (token === generation && state === s) {
        s.phase = 'player'; s.spent = []; delete s.queued; s.active = 0;
        stand(); busy = false; void callbacks.change(s); render();
      }
    }
    return { ok: true, text };
  }
  const ui = {
    demo,
    /** Development: what the picker needs to offer this fight's moments. */
    get fight() { return state && { encounter: state.encounter, phase: state.phase, awakened: state.awakened, busy, song: songLabel(state), light: lightNow(state) }; },
    /** Development and screenshots: the fight itself, to set a moment no picker entry stages (it shows on the next thing drawn). */
    get live() { return state; },
    jumpTo,
    /** Whether the artilugio does anything in this fight now (she has Aitor and the party carries it). */
    get artilugioLive() { return !!state && artilugioLive(state); },
    /** A note of the artilugio, at any moment, on nobody's turn (docs/castle-bosses.md § With the artilugio). */
    note,
    /** Development (the picker's Ánimas column): the ánimas L and R walk through and their levels, changed mid-fight. */
    setAnimas(animas: ClassId[], levels: Partial<Record<ClassId, number>>, kits: Partial<Record<string, ClassId[]>> = {}) {
      if (!state) return;
      state.animas = [...animas]; state.levels = { ...levels };
      for (const ally of state.allies) if (kits[ally.id]) ally.kit = [...kits[ally.id]!];
      render();
    },
    /** Development (the picker's Ayudas): changes the fight as a help asks, and redraws it at once. */
    tweak(change: (state: BattleState) => void) { if (!state) return; change(state); render(); },
    /** Whether the pause menu can offer to fight this again from the start: a fight under way or lost, where a fall is forgiven (`forgiving`). */
    get retriable() { return !!state && !!reopen && !finale && state.phase !== 'won' && state.phase !== 'escaped' && !!callbacks.forgiving?.(); },
    /** The pause menu's «Reintentar el combate»: the fight opens again from the start, and this one reaches nothing (`fallen`). */
    retry() { if (ui.retriable && !holdingRewards()) close('retry'); },
    /** Development: leaves the fight at once, with no result (the picker, before going elsewhere). */
    end() { if (state) close(); },
    /**
     * Where the fight's input is; its third part names an open sub-menu (a command, the summary, or
     * the keyboard player's move ready ahead), so Escape backs out of it (or takes it back) before pausing.
     */
    get controllerContext() { return !state ? 'world' : guideOpen ? `battle:guia:${guideOpen.id}` : holdOn ? 'battle:hold' : `battle:${busy ? 'busy' : state.phase}:${selected ?? (summaryOpen ? 'summary' : queueContext())}:${selectedSkill ?? pickingDie ?? ''}:${targeting}`; },
    /**
     * The same for one player's controller. Split, it is that player's own menu and whether their
     * fighter can choose: a press is held back while their own screen changes, never because the
     * partner opened a menu or a move started playing.
     */
    controllerContextOf(player: PlayerId) {
      if (!state || !split() || guideOpen || holdOn) return ui.controllerContext;
      const m = player === ctx ? { selected, selectedSkill, pickingDie, targeting } : menus[player];
      return `battle:${state.phase}:${m.selected ?? (summaryOpen ? 'summary' : '')}:${m.selectedSkill ?? m.pickingDie ?? ''}:${m.targeting}:${canAct(allyOf(player)) ? 'choosing' : 'waiting'}`;
    },
    /** △ / Y (X on a Switch pad): the details window beside the focused skill; on the commands, or aiming Atacar, its next element. */
    details(player: PlayerId = 1) {
      if (!state || guideOpen) return;
      const press = () => {
        if (state!.phase === 'player' && (!selected || (selected === 'attack' && targeting))) nextElement(state!.allies[state!.active]);
        else showDetails(!details);
      };
      if (!split()) { if (!busy && player === turnDriver()) press(); return; }
      withPlayer(player, () => { if (!locked()) press(); });
    },
    /** A controller press; `player` is whose controller it is. Only the turn's own player is heard. */
    control(action: ControlAction | 'prev' | 'next', player: PlayerId = 1) {
      if (!state) return;
      if (finale) return;
      // A guide card holds the fight: either player's confirm or back closes it.
      if (guideOpen) { if (action === 'confirm' || action === 'cancel') closeGuide(); return; }
      if (holdOn) { if (action === 'confirm') releaseHold(); return; }
      if (heldChoice) { if (player === heldDriver() && action !== 'prev' && action !== 'next') heldControl(action); return; }
      if (action === 'cancel' && summaryOpen) { toggleSummary(false); return; }
      const ended = ['won', 'lost', 'escaped'].includes(state.phase);
      if (ended) {
        // Backing out of a fall that can be undone steps back to before the fight.
        if (action === 'cancel') { if (!holdingRewards()) close(state.phase === 'lost' && callbacks.forgiving?.() ? 'rewind' : undefined); }
        else if (action === 'confirm') clickControllerButton(root);
        else if (action !== 'menu' && action !== 'prev' && action !== 'next') navigate(action);
        return;
      }
      const press = () => {
        // L / R: their fighter's previous or next ánima.
        if (action === 'prev' || action === 'next') changeAnima(action === 'prev' ? -1 : 1);
        else if (action === 'cancel') back();
        else if (action === 'confirm') { const button = cursor(); if (button && !button.disabled && !button.closest('[hidden], [inert]')) { pointerPlayer = player; try { button.click(); } finally { pointerPlayer = 1; } } }
        else if (action !== 'menu') navigate(action);
      };
      // Alone, only the turn's own player is heard; split, each player works their own menu at any moment.
      if (!split()) { if (!busy && player === turnDriver()) press(); return; }
      withPlayer(player, () => { if (!locked()) press(); });
    },
    /** The D-pad's left or right (src/controller.ts `readController`): for either player at any moment. */
    toggleSummary() { if (!guideOpen) toggleSummary(); },
    /** Whether the summary is open (scenarios and tests). */
    get summary() { return summaryOpen; },
    positionTargets(targets: { id: string; x: number; y: number; visible: boolean }[]) {
      // Every frame: each plate is looked up once and only written when it moves, since a write of
      // the same value still makes the browser work out styles again.
      for (const target of targets) {
        positions.set(target.id, target);
        let plate = plates.get(target.id);
        if (!plate?.isConnected) {
          plate = root.querySelector<HTMLElement>(`.battle-target[data-target="${target.id}"]`) ?? undefined;
          if (plate) plates.set(target.id, plate); else { plates.delete(target.id); continue; }
        }
        if (plate.hidden === target.visible) plate.hidden = !target.visible;
        const transform = `translate(${target.x.toFixed(1)}px, ${target.y.toFixed(1)}px) translate(-50%, -100%)`;
        if (plateAt.get(plate) !== transform) { plateAt.set(plate, transform); plate.style.transform = transform; }
      }
    },
    /** `party` is who fights on Gerard's side (story.battleParty), or a size for chapter 1's boys. */
    /** `animas` are the party's unlocked ánimas (story.classes); L and R walk through them. `guards` sizes the palace guards. */
    open(party: PartySlot[] | 1 | 2, foeCount = 1, options: { possessed?: boolean; encounter?: Encounter; lastWord?: string; animas?: ClassId[]; guards?: GuardStrength; night?: NightFight; friends?: readonly string[]; strong?: boolean; levels?: Partial<Record<ClassId, number>>; xp?: Partial<Record<ClassId, number>>; cap?: number; improved?: Improved } = {}) {
      if (state) return;
      const count = foeCount;
      reopen = (): void => { ui.open(party, count, options); };
      onPlates.clear();
      previousFocus = document.activeElement as HTMLElement;
      const token = ++generation;
      const { possessed = false, encounter = 'dogs' } = options;
      const slots = typeof party === 'number' ? childParty(party, options.animas?.at(-1)) : party;
      state = createEncounter(slots, encounter, { foeCount, possessed, animas: options.animas, guards: options.guards, night: options.night, friends: options.friends, strong: options.strong }); busy = true;
      state.levels = options.levels;
      improve(state, options.improved);
      xpBefore = { ...options.xp }; levelCap = options.cap; rewarded = false; finale = false; delete root.dataset.finale; resetRewards();
      foeCount = state.foes.length;
      root.toggleAttribute('data-possessed', possessed);
      root.dataset.encounter = encounter;
      get('[data-command="skill"]').classList.remove('is-new');
      get('.class-banner').hidden = true; get('.dual-banner').hidden = true; get('.dual-cinema').hidden = true; clearTimeout(calloutTimer); get('.move-callout').hidden = true; get('.battle-speech').replaceChildren();
      queueMenu = undefined; firing = undefined; stale = undefined; slowUntil = 0; charges = 0;
      pending.length = 0; duo = undefined; ctx = 1; menus[1] = { targeting: false }; menus[2] = { targeting: false }; loadMenu(1);
      aimedBy[1] = aimedBy[2] = undefined; callbacks.target(undefined, 1); callbacks.target(undefined, 2);
      lastWord = options.lastWord; wordSaid.clear();
      get('.battle-heading h1').innerHTML = FEAR_TITLES[encounter as keyof typeof FEAR_TITLES] ?? (encounter === 'palace-minion' ? 'Un esbirro <em>de verdad.</em>' : encounter === 'palace-guards' ? 'Los guardianes <em>de la cortina.</em>' : encounter === 'night-guard' ? 'De vuelta <em>a casa.</em>' : possessed ? 'Ojos <em>rosados.</em>' : 'Un pequeño <em>contratiempo.</em>');
      get('.battle-targets').innerHTML = [...state.foes, ...state.allies].map((f, i) => plateHtml(f, i, i < foeCount)).join('');
      root.dataset.entering = 'true'; delete root.dataset.resolving;
      // Her entrance (src/throne-arena.ts THRONE_INTRO, played by the game): the bars and her name over it, and no HUD until it ends.
      const card = BOSS_CARDS[encounter], entrance = !!card && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (card) { get('.boss-place').textContent = card.place; get('.boss-who').innerHTML = card.who; get('.boss-sub').textContent = card.sub; root.dataset.boss = card.held ? 'held' : 'reina'; }
      root.toggleAttribute('data-intro', entrance); for (const key of ['introEnd', 'introRun', 'introName', 'introPull'] as const) delete root.dataset[key];
      root.querySelectorAll('.party-card').forEach(card => card.remove()); root.querySelectorAll('.anima-chips').forEach(chips => chips.removeAttribute('data-for'));
      get('.battle-pops').replaceChildren(); positions.clear();
      hud.dataset.battle = 'open'; outside().forEach(el => { el.inert = true; });
      root.hidden = false; render(); root.focus({ preventScroll: true }); startClock();
      get('.turn-meta').textContent = 'ENCUENTRO';
      void callbacks.change(state).then(() => {
        if (token !== generation || !state) return;
        delete root.dataset.entering; busy = false; render();
        if (root.hasAttribute('data-intro')) {
          root.removeAttribute('data-intro'); for (const key of ['introRun', 'introName', 'introPull'] as const) delete root.dataset[key]; root.dataset.introEnd = 'true';
          setTimeout(() => { if (token === generation) delete root.dataset.introEnd; }, 900);
        }
        for (const p of [1, 2] as PlayerId[]) withPlayer(p, focusFirst);
        // Split, a move confirmed while the fight was coming in goes now.
        if (pending.length) void run();
      });
    },
    /** La Reina Bubbaloo's entrance (src/game.ts): it has started (the skip hint), her name is up, the camera pulls back (the bars open). */
    entrance(moment: 'start' | 'title' | 'pull') {
      if (moment === 'start') root.dataset.introRun = 'true';
      else if (moment === 'title') root.dataset.introName = 'true';
      else { delete root.dataset.introName; root.dataset.introPull = 'true'; }
    },
    /** Redraws the turn line when a controller connects or leaves. */
    refresh() {
      if (!state) return;
      render();
      if (!busy && state.phase === 'player' && !targeting && !selected && !root.contains(document.activeElement)) focusFirst();
    },
    destroy() { generation++; cancelAnimationFrame(clockFrame); root.removeEventListener('keydown', keydown); root.remove(); outside().forEach(el => { el.inert = false; }); delete hud.dataset.battle; },
  };
  return ui;
}
