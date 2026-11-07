import { clickControllerButton } from './controller-ui';
import type { ControlAction } from './controller';
import { attackElement, chooseElement, cycleElement, elementsFor, ELEMENTS, improve, manaMax, woundScale, markLeft, markSpent, kitIn, DUALS, dualPartner, FEAR_ENCOUNTERS, createFearBattle, DISHES, act, actDual, aimed, awaken, BEAT_HP, boostedStats, boostRounds, commit, dualCost, dualOptions, statNames, intentLabel, isOnion, childParty, cornered, createBattle, createGuardBattle, createMinionBattle, enemyAct, nextRound, palaceGuards, queue, queuedDual, roman, runClock, skillsFor, SKILLS, STAGED_MOMENTS, stageMoment, STAT_SHORT, statShifts, STATUSES, switchAnima, takeNews, takeQueued, TIMED, validTargets, WEAK_SPOT, weakSpotRounds, wearAnima, wearsAnimas, type ClassId, type DualBlock, type DualId, type DualSpec, type Element as AttackElement, type Encounter, type GuardStrength, type Improved, type PartySlot, type Queued, type SkillId, type StagedMoment, type BattleAction, type BattleEffect, type BattleState, type Combatant, type StatShift, type StatusId, type Timed, type TimedId } from './battle';
import { animaOf, CLASSES, grownUp } from './classes';
import { BATTLE_LINES } from './chapter-1';
import { SPEAKERS } from './dialogue';
import { ELEMENT_ICONS } from './ecos';
import { costPips, flashAnima, setVitals, vitalsPlate } from './vitals';
import { DOG_PROFILES } from './encounters';
import { planEnemyTurn } from './battle-ai';
import { BEAT, DUAL_BANNER, DUAL_BANNER_SEEN, DUAL_EASE, DUAL_SLOW, holdAfter } from './battle-motion';
import { award, fightXp, levelForXp, levelProgress, MAX_LEVEL, participants, toNextLevel, type Growth } from './levels';
import type { Direction } from './movement';
import type { PlayerId } from './party';
import type { SoundId } from './sfx';

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
const FEAR_KICKERS = { cebollon: 'EL CEBOLLÓN', cebolla: 'LA CEBOLLA', plato: 'EL PLATO MISTERIOSO', escolta: 'LA CEBOLLA Y LOS SUYOS', 'uri-vertigo': 'VERTITRÓN' } as const;
const FEAR_TITLES = { cebollon: 'Capa sobre <em>capa.</em>', cebolla: 'Pesa, <em>y pica.</em>', plato: '¿Y esto qué <em>lleva?</em>', escolta: 'Nunca viene <em>sola.</em>', 'uri-vertigo': 'Mucho más <em>alto.</em>', 'crias-1': 'Pequeñas, <em>pero pican.</em>', 'crias-2': 'Para <em>picar.</em>', 'crias-3': 'Nivel <em>extra.</em>' } as const;
/** What a blow says it did to an onion's layers. */
const peelText = (peeled: number, onion?: { layers?: number }) => !onion?.layers ? '¡Sin capas!' : peeled > 1 ? `¡${peeled} capas menos!` : '¡Una capa menos!';
const TARGETS = { foes: 'Un enemigo', 'all-foes': 'Todos los enemigos', allies: 'Un aliado herido', party: 'Todo el equipo' } as const;
/** A fighter's ánima pills, with L and R (Q and E) on either side to walk through them. */
const ANIMA_SWITCH = `<div class="anima-switch" role="group" aria-label="Ánima" hidden><span class="battle-kicker">ÁNIMA</span><button class="anima-key" type="button" tabindex="-1" data-step="-1" aria-label="Ánima anterior"><kbd data-glyph="prev"></kbd></button><div class="anima-chips"></div><button class="anima-key" type="button" tabindex="-1" data-step="1" aria-label="Ánima siguiente"><kbd data-glyph="next"></kbd></button></div>`;
/** What a fighter's plate shows as an icon: their statuses, and Punto débil (a dual's mark: the next blow lands WEAK_SPOT times). */
type IconId = StatusId | TimedId | 'punto-debil';
/** Each status's icon over whoever carries it (SVG on a 16 × 16 box, drawn in its colour). */
const STATUS_ICONS: Record<IconId, string> = {
  'punto-debil': '<path d="M8 1.5v3.2M8 11.3v3.2M1.5 8h3.2M11.3 8h3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="8" r="4.3" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="1.5"/>',
  quemado: '<path d="M8 1.2c.6 2.6 3.8 4 3.8 7.9a3.8 3.8 0 0 1-7.6 0c0-2 1-3.3 2-4.2-.1 1.6.5 2.6 1.3 2.9C7 6 7 3.4 8 1.2z"/>',
  cegado: '<path d="M1.5 8S4 3.8 8 3.8 14.5 8 14.5 8 12 12.2 8 12.2 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="1.9"/><path d="M2.6 13.4 13.4 2.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  sangrado: '<path d="M8 1.5C6.2 4.6 4.2 7 4.2 9.8a3.8 3.8 0 0 0 7.6 0C11.8 7 9.8 4.6 8 1.5z"/>',
  mareo: '<path d="M8.6 8a.6.6 0 1 1-1.2 0 1.8 1.8 0 1 1 3.6 0 3 3 0 1 1-6 0 4.2 4.2 0 1 1 8.4 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  llorera: '<path d="M5 3.5C4 5.6 3 6.8 3 8.3a2 2 0 0 0 4 0C7 6.8 6 5.6 5 3.5zm6 3C10 8.6 9 9.8 9 11.3a2 2 0 0 0 4 0c0-1.5-1-2.7-2-4.8z"/>',
  // A cross of cure (Rayo de sanación), and a question mark (Confusión).
  sanacion: '<path d="M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5z"/>',
  confusion: '<path d="M5.3 5.7a2.7 2.7 0 1 1 4 2.4c-.8.5-1.3 1-1.3 2v.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="13.2" r="1.15"/>',
  // Four arrows pointing in (Encogido).
  encogido: '<path d="M2 2l4 4M14 2l-4 4M2 14l4-4M14 14l-4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3.5 6H6V3.5M12.5 6H10V3.5M3.5 10H6v2.5M12.5 10H10v2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
};
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
/** "1 ronda", "3 rondas". */
const rounds = (n: number) => `${n} ${n === 1 ? 'ronda' : 'rondas'}`;
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const statusSvg = (id: IconId) => `<svg viewBox="0 0 16 16" aria-hidden="true">${STATUS_ICONS[id]}</svg>`;
/** A stat up or down in words: «Defensa +4», or «Defensa ▼» for an onion's broken defence, which has no number. */
const shiftText = (shift: StatShift) => `${statNames([shift.stat])} ${shift.amount ? `${shift.way === 'up' ? '+' : '−'}${shift.amount}` : shift.way === 'up' ? '▲' : '▼'}`;
/** The queue's hints go once used: preparing a choice ahead, and taking it back. */
let queueLearned = false, unqueueLearned = false;
/** Duals already seen this session: their banner holds for less (DUAL_BANNER_SEEN). */
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
export type FightMoment = 'won' | 'won-level' | 'lost' | 'foes-low' | 'party-low' | 'beat' | StagedMoment;

export function createBattleUI(hud: HTMLElement, callbacks: {
  /** `onImpact` runs as each blow lands: 0 at contact, then a flurry's others (`BattleEffect.strikes`). */
  change: (state: BattleState | undefined, effect?: BattleEffect, onImpact?: (blow: number) => void) => Promise<void>;
  target: (id?: string) => void;
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
  pulse: (id: string) => void;
  /** Whether a fall here can be fought again or stepped back from: everywhere but chapter 2's castle, where it wakes Gerard up at home. */
  forgiving?: () => boolean;
  /** On the lost screen the players chose to fight again or go back to just before the fight: the end that follows is no fall. */
  fallen?: (choice: 'retry' | 'rewind') => void;
  /** Development build (`import.meta.env.DEV`): the Dual command takes its place in the menu. */
  dev?: () => boolean;
  /** A dual's banner: the 3D fight runs at `scale` for `seconds` of real time, then eases back (the scene's FightClock). */
  slowmo?: (scale: number, seconds: number) => void;
  /** How fast the 3D fight runs now (1: full speed), all its slow motions together: the fight's clock follows it. */
  speed?: () => number;
}) {
  const COMMANDS = commandsFor(!!callbacks.dev?.());
  const root = document.createElement('section');
  root.id = 'battle'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Combate por turnos');
  root.innerHTML = `
    <div class="dual-cinema" aria-hidden="true" hidden><i></i><b></b></div>
    <header class="battle-heading"><span class="battle-kicker">ENCUENTRO / PASSATGE MARESME</span><h1>Un pequeño <em>contratiempo.</em></h1></header>
    <div class="round-badge"><span>RONDA</span><strong>01</strong></div>
    <button class="summary-key" type="button" tabindex="-1" aria-controls="battle-summary" hidden><kbd data-glyph="summary"></kbd> Resumen</button>
    <section class="battle-summary" id="battle-summary" aria-label="Resumen del combate" hidden></section>
    <div class="battle-targets" aria-label="Objetivos en la calle"></div>
    <div class="battle-pops" aria-hidden="true"></div>
    <div class="battle-speech" aria-live="assertive"></div>
    <section class="class-banner" hidden><span class="battle-kicker">ÁNIMA DESBLOQUEADA</span><h2></h2><p></p></section>
    <section class="dual-banner" aria-live="polite" hidden><header><span class="battle-kicker">ATAQUE DUAL</span><h2></h2></header><div class="dual-halves"></div><footer><strong class="dual-total"></strong><p></p></footer></section>
    <section class="skill-reveal" aria-live="polite" hidden><i class="skill-reveal-rays" aria-hidden="true"></i><div class="skill-reveal-card"><span class="battle-kicker"></span><small class="skill-reveal-who"></small><div class="skill-reveal-skills"></div></div></section>
    <p class="dev-badge" hidden>DEPURACIÓN · UN JUGADOR LLEVA A LOS DOS</p>
    <div class="battle-bottom">
      <section class="battle-dock" data-dock="1">
      <div class="dock-plate"></div>
      ${ANIMA_SWITCH}
      <p class="dock-wait" hidden></p>
      ${QUEUE_PARTS}
      <section class="command-panel" aria-label="Acciones de combate">
        <div class="turn-heading"><span class="turn-dot"></span><span class="turn-label"></span><span class="turn-meta">TU TURNO</span></div>
        <div class="command-deck">
          <div class="commands">${COMMANDS.map((c, i) => `<article class="command" data-command="${c.id}">
            <button class="command-trigger" type="button" ${c.id === 'skill' || c.id === 'dual' ? 'aria-expanded="false" aria-controls="skill-flyout"' : ''}><span class="command-number">0${i + 1}</span><strong>${c.name}</strong>${c.id === 'attack' ? '<small class="attack-element-name"></small>' : ''}${c.id === 'skill' || c.id === 'dual' ? '<span class="command-arrow" aria-hidden="true">›</span>' : ''}</button>${c.id === 'attack' ? '<div class="attack-elements" role="group" aria-label="Elemento de Atacar" hidden></div>' : ''}
          </article>`).join('')}</div>
          <section class="skill-flyout" id="skill-flyout" aria-label="Habilidades" inert><div class="skill-sheet">
            <span class="battle-kicker"></span>
            <span class="skill-more" data-more="up" aria-hidden="true"></span>
            <div class="skill-window"><div class="skill-list"></div><div class="skill-rail" aria-hidden="true" hidden></div></div>
            <span class="skill-more" data-more="down" aria-hidden="true"></span>
            <footer><button class="command-back" type="button">Volver <span data-glyph="cancel"></span></button><p class="flyout-hint"><kbd data-glyph="details"></kbd> Detalles</p></footer>
          </div></section>
        </div>
        <div class="target-picker" hidden><span class="battle-kicker">ELIGE UN OBJETIVO</span><h2></h2><p></p><button class="target-back" type="button">Volver <span data-glyph="cancel"></span></button></div>
        <p class="command-help"></p>
      </section>
      </section>
      <section class="battle-dock" data-dock="2" data-glyph-player="2" hidden>
      <div class="dock-plate"></div>
      ${ANIMA_SWITCH}
      <p class="dock-wait" hidden></p>
      ${QUEUE_PARTS}
      </section>
      <div class="party-roster" aria-label="Tu equipo"></div>
    </div>
    <aside class="skill-info" role="tooltip" id="skill-info" hidden><h3></h3><p></p><strong class="skill-info-cost"></strong></aside>
    <section class="battle-result" hidden><span class="battle-kicker">FIN DEL ENCUENTRO</span><h2></h2><p></p>
      <div class="result-xp" hidden><span class="battle-kicker">EXPERIENCIA</span><strong></strong></div>
      <ul class="result-animas" aria-label="Ánimas que han luchado" hidden></ul>
      <button type="button" data-after="close">Volver a la calle</button>
      <button type="button" data-after="retry" hidden>Reintentar el combate</button>
      <button type="button" data-after="rewind" hidden>Volver a antes del combate</button></section>`;
  hud.append(root);
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  /** At most this many skills in sight on the sheet, which never rises above `SHEET_TOP` px from the top of the screen. */
  const SKILL_ROWS = 4, SHEET_TOP = 96;
  let state: BattleState | undefined;
  let selected: Command | undefined;
  let selectedSkill: SkillId | undefined;
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
  const shownTimed = (c: Combatant) => ({ ...c.timed, quemado: shownFire(c) });
  /** An action chosen whose first blow has not landed: nobody's statuses change on screen until it does. */
  let unlanded = false;
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
  /** The victory screen's ánimas are shown once per fight. */
  let rewarded = false;
  let rewardFrame = 0;
  const outside = () => [...hud.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== root);
  const articles = [...root.querySelectorAll<HTMLElement>('.command')];
  function focusFirst() { get<HTMLButtonElement>('.command-trigger').focus({ preventScroll: true }); }
  const panel = get('.command-panel');
  const skillButtons = () => [...root.querySelectorAll<HTMLButtonElement>('.skill-list [data-skill], .skill-list [data-dual]')];
  /** Why a command can't be used now, if it can't. Bernat has no skills: he only attacks. */
  function blocked(command: Command) {
    if (!state || busy || state.phase !== 'player' || callbacks.waiting(state.allies[state.active].id)) return true;
    if (command === 'dual') return !wearsAnimas(state.allies[state.active]) || state.allies.length < 2;
    if (command === 'escape') return cornered(state);
    if (command === 'skill') return !skillsFor(state, state.allies[state.active]).length;
    return false;
  }
  // The dark trail lags behind the fill, so each hit shows how much it took.
  function fill(bar: Element, ratio: number) { bar.querySelectorAll<HTMLElement>('b, i').forEach(el => { el.style.width = `${ratio * 100}%`; }); }
  const positions = new Map<string, { x: number; y: number }>();
  /** A number or a word flying off a fighter. A `status` one (its id in `status`) is stamped on in its colour, above where the blow's numbers rise. */
  function pop(id: string, text: string, kind: 'damage' | 'heal' | 'guard' | 'stat-up' | 'stat-down' | 'status', detail = '', status?: string, dx = 0) {
    const at = positions.get(id);
    if (!at) return;
    const el = document.createElement('span');
    el.className = 'damage-pop'; el.dataset.kind = kind;
    if (status) el.dataset.status = status;
    el.innerHTML = `<strong></strong>${detail ? '<small></small>' : ''}`;
    el.querySelector('strong')!.textContent = text;
    if (detail) el.querySelector('small')!.textContent = detail;
    el.style.transform = `translate(${at.x + dx + (Math.random() - .5) * (kind === 'status' ? 8 : 26)}px, ${at.y - (kind === 'status' ? 96 : 18)}px) translate(-50%, -100%)`;
    get('.battle-pops').append(el);
    setTimeout(() => el.remove(), kind === 'status' ? 1350 : 1100);
    return el;
  }
  const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
  /** The statuses on someone, in the order the plate and the summary show them: stacks or level, and how long they last. */
  function statusList(c: Combatant): { id: IconId; name: string; mark: string; timed: boolean; lasts: string }[] {
    const weak = state ? weakSpotRounds(state, c) : 0;
    return shownHp(c) > 0 ? [
      ...weak ? [{ id: 'punto-debil' as const, name: `Punto débil: el siguiente golpe hace el triple`, mark: `×${WEAK_SPOT}`, timed: false, lasts: rounds(weak) }] : [],
      ...(Object.entries(c.statuses ?? {}).filter(([, n]) => n) as [StatusId, number][]).map(([id, n]) => ({ id, name: `${STATUSES[id].name} ${n}`, mark: String(n), timed: false, lasts: rounds(Math.ceil(n / STATUSES[id].decay)) })),
      ...(Object.entries(shownTimed(c)).filter(([, on]) => on) as [TimedId, Timed][]).map(([id, on]) => ({ id, name: `${TIMED[id].name} ${roman(on.level)}`, mark: roman(on.level), timed: true, lasts: `${Math.ceil(on.left)} s` })),
    ] : [];
  }
  /** The fears' own rules, where the player can read them (docs/quests/nuria.md). */
  function ruleChips(c: Combatant): [string, string][] {
    const chips: [string, string][] = [];
    if (c.hp > 0 && c.layers) chips.push(['capas', `Capas ${c.layers}`]);
    if (c.hp > 0 && c.dish) chips.push(['plato', DISHES[c.dish].name.replace(/^una /, '')]);
    if (c.hp <= 0) return chips;
    // A fantasmita goes off at everyone at 0; on its last count blows go through it.
    if (c.countdown !== undefined) chips.push(['reinicio', `Game over en ${c.countdown}`]);
    if (c.transparent) chips.push(['transparente', 'Transparente']);
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
    const signature = [...icons.map(i => `${i.id}${i.mark}`), ...chips.map(([id, text]) => `${id}${text}`), '|', ...shifts.map(shift => shift.title)].join(',');
    if (list.dataset.for !== signature) {
      list.dataset.for = signature;
      // Several at once sit closer and a little smaller, so they still fit over one head.
      list.toggleAttribute('data-many', icons.length + chips.length > 2);
      list.replaceChildren(...icons.map(icon => {
        const el = document.createElement('i'); el.className = 'status-icon'; el.dataset.status = icon.id; el.title = icon.name;
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
   * A timed status's clock: its ring empties and its hand turns as its time runs out, and a notch
   * marks each pulse still to come, where the hand will be when it hurts (`--ticks`).
   */
  function drain(plate: Element, c: Combatant) {
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
    const rules = ruleChips(c).map(([id, text]) => `<li class="summary-rule" data-status="${id}"><b>${escapeHtml(text)}</b></li>`);
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
   * own moments (the palace beat), once it is over and while the pause menu is open.
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
    const seconds = Math.min(.1, Math.max(0, (now - clockLast) / 1000)) * (callbacks.speed?.() ?? clockScale(now)); clockLast = now;
    if (!state || root.dataset.entering || root.dataset.beat || callbacks.paused()) return;
    const pulses = runClock(state, seconds, c => heldFire.has(c.id));
    // What a pulse brought on (Vertitrón's eye burnt out) plays once nothing else is.
    if (state.news?.length && !busy) void showNews();
    for (const c of [...state.foes, ...state.allies]) { const plate = root.querySelector(`.battle-target[data-target="${c.id}"]`); if (plate) drain(plate, c); }
    if (summaryOpen && now - summaryAt > 250) { summaryAt = now; renderSummary(); }
    if (!pulses.length) return;
    if (pulses.some(p => !p.heal)) callbacks.sound('burn');
    if (pulses.some(p => p.heal)) callbacks.sound('heal');
    for (const p of pulses) {
      // A cure's pulse (Sanación) gives PV back: its number in green, no flare on the body.
      if (p.heal) pop(p.target, `+${p.amount}`, 'heal', `${TIMED[p.status].name} ${roman(p.level)}`);
      else { pop(p.target, `−${p.amount}`, 'damage', `${TIMED[p.status].name} ${roman(p.level)}`); callbacks.pulse(p.target); }
      // Its clock flashes as the notch it reached hurts.
      root.querySelectorAll<HTMLElement>(`[data-target="${p.target}"] .status-icon[data-status="${p.status}"], [data-unit="${p.target}"] .status-icon[data-status="${p.status}"]`).forEach(icon => { icon.classList.remove('is-pulsing'); void icon.offsetWidth; icon.classList.add('is-pulsing'); });
    }
    // A fire can end the fight on its own: the result shows once nothing is being played.
    render();
  }
  function startClock() { cancelAnimationFrame(clockFrame); clockLast = performance.now(); clockFrame = requestAnimationFrame(tickClock); }
  /** A line said over a fighter's head, inside the fight (the rest of the HUD is shut). */
  async function speak(line: { speaker: keyof typeof SPEAKERS; text: string }, ms: number, shout = false) {
    const at = positions.get(line.speaker);
    const el = document.createElement('p');
    el.className = 'battle-speech-line'; el.dataset.speaker = line.speaker; if (shout) el.dataset.shout = 'true';
    el.innerHTML = '<span></span>';
    el.querySelector('span')!.textContent = line.text;
    el.style.setProperty('--accent', SPEAKERS[line.speaker].accent);
    // Never off the top of the screen (Uri up on Vertitrón): a bubble that would be stays just under the heading.
    if (at) el.style.transform = `translate(${at.x}px, ${Math.max(at.y - 40, shout ? 130 : 90)}px) translate(-50%, -100%)`;
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
    await wait(2600);
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
    const most = manaMax(state?.improved, id), left = id === owner.classId ? owner.secondary : owner.mana?.[id] ?? most;
    const box = button.querySelector<HTMLElement>('.chip-mana');
    if (!box) return;
    box.hidden = !most;
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
    const button = document.activeElement instanceof HTMLButtonElement && (document.activeElement.dataset.skill || document.activeElement.dataset.dual) ? document.activeElement : undefined;
    const skill = button && SKILLS.find(s => s.id === button.dataset.skill);
    // Development: a dual's details, with its combined cost (each half under whoever pays it).
    const dual = button && DUALS.find(d => d.id === button.dataset.dual);
    const option = dual && state ? dualOptions(state, true).find(o => o.dual === dual) : undefined;
    box.hidden = !details || (!skill && !dual) || !state;
    if (box.hidden || !state) { button?.removeAttribute('aria-describedby'); return; }
    button!.setAttribute('aria-describedby', 'skill-info');
    box.querySelector('h3')!.textContent = skill?.name ?? dual!.name;
    box.querySelector('p')!.textContent = skill?.description ?? dual!.description;
    box.querySelector('.skill-info-cost')!.innerHTML = skill ? `MANÁ ${costPips(skill.cost)}` : `MANÁ ${dualTotal(dual!).replace(' maná', '')} ${dualPips(dual!, id => option ? wearerOf(option, id)?.name ?? '' : '')}`;
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
  const dockOf = (allyId: string) => get(`.battle-dock[data-dock="${split() ? callbacks.driver(allyId) : 1}"]`);
  /** Whose dock it is: in a split fight its player's fighter, alone whoever's turn it is. */
  const ownerOf = (dock: HTMLElement) => !state ? undefined : split() ? state.allies.find(a => callbacks.driver(a.id) === Number(dock.dataset.dock)) : state.allies[state.active];
  /** Whether the commands sit in Aitor's dock, which mirrors the menu (skills open to the left). */
  const mirrored = () => !!panel.closest('.battle-dock[data-dock="2"]');
  /** Whose hands the current turn is in; nobody else's input counts. */
  const turnDriver = (): PlayerId => state && state.phase === 'player' ? callbacks.driver(state.allies[state.active].id) : 1;
  const targetButtons = () => [...root.querySelectorAll<HTMLButtonElement>('.roster-target:not(:disabled), .battle-target[data-side="foes"]:not(:disabled)')].filter(button => !button.hidden);
  /** A fighter's nameplate over their head (PV, maná for the party, statuses); a foe's is also how it is picked. */
  function plateHtml(f: Combatant, i: number, foe: boolean) {
    const colour = f.kind === 'minion' || f.kind === 'guardian' ? '#ff6fae' : f.kind === 'vertigo-ojo' ? '#b07aff' : DOG_PROFILES[i]?.collar ?? '#b9dba1';
    return `<button class="battle-target" type="button" tabindex="-1" data-target="${f.id}" ${foe ? `data-unit="${f.id}"` : ''} data-side="${foe ? 'foes' : 'allies'}" style="--dog-color:${colour}" aria-label="Elegir a ${f.name}" hidden disabled><span class="enemy-health" aria-hidden="true"><b style="width:100%"></b><i style="width:100%"></i></span>${foe || !f.maxSecondary ? '' : `<span class="plate-pips" aria-hidden="true">${'<i data-pip="full"></i>'.repeat(f.maxSecondary)}</span>`}</button>`;
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
  function render() {
    if (!state) return;
    ensurePlates();
    const ended = !busy && ['won', 'lost', 'escaped'].includes(state.phase);
    root.dataset.phase = state.phase;
    const fear = FEAR_KICKERS[state.encounter as keyof typeof FEAR_KICKERS];
    get('.battle-heading .battle-kicker').textContent = fear ? `ENCUENTRO / ${fear}`
      : state.encounter === 'palace-minion' ? 'ENCUENTRO / ESBIRRO DE LA REINA'
      : state.encounter === 'palace-guards' ? `ENCUENTRO / ${state.foes.filter(f => shownHp(f) > 0).length} DE ${state.foes.length} ${state.foes.length === 1 ? 'GUARDIÁN' : 'GUARDIANES'} DE CHICLE`
      : state.encounter.startsWith('crias-') ? `ENCUENTRO / ${state.foes.filter(f => shownHp(f) > 0).length} DE ${state.foes.length} CRÍAS DEL MIEDO`
      : `ENCUENTRO / ${state.foes.filter(f => shownHp(f) > 0).length} DE ${state.foes.length} PERROS${state.possessed ? ' POSEÍDOS' : ''}`;
    get('.round-badge strong').textContent = String(state.round).padStart(2, '0');
    const actor = state.allies[state.active];
    get('.turn-label').textContent = actor.name;
    const waiting = !busy && state.phase === 'player' && callbacks.waiting(actor.id);
    get('.turn-meta').textContent = busy || state.phase === 'enemy' ? 'EN ACCIÓN' : waiting ? 'CONECTA EL MANDO 2' : callbacks.driver(actor.id) === 2 ? 'MANDO 2' : 'TU TURNO';
    root.dataset.player = String(turnDriver());
    root.toggleAttribute('data-waiting', waiting);
    // Cards are kept (and moved between docks) so the waves glide instead of snapping.
    const roster = get('.party-roster');
    if (!root.querySelector('.party-card')) roster.innerHTML = state.allies.map(c => `<article class="party-card" data-unit="${c.id}" data-anima="${c.classId ?? 'none'}">${plate(c)}<span class="unit-boost" hidden></span><span class="unit-status"></span><button class="roster-target" type="button" data-target="${c.id}" aria-label="Elegir a ${c.name}" hidden></button></article>`).join('');
    const isSplit = split();
    root.toggleAttribute('data-split', isSplit);
    get('.dev-badge').hidden = isSplit || !callbacks.solo() || !state.allies.some(a => a.id === 'aitor');
    get('.battle-dock[data-dock="2"]').hidden = !isSplit;
    // The commands live in the dock whose turn it is.
    if (state.phase === 'player' && panel.parentElement !== dockOf(actor.id)) { dockOf(actor.id).append(panel); if (!busy) focusFirst(); }
    for (const dock of root.querySelectorAll<HTMLElement>('.battle-dock')) {
      const owner = ownerOf(dock);
      if (!owner || dock.hidden) continue;
      const mine = state.phase === 'player' && state.allies[state.active] === owner;
      dock.dataset.anima = owner.classId ?? 'none'; dock.dataset.member = owner.id;
      dock.classList.toggle('is-turn', mine && !busy);
      const wait = dock.querySelector<HTMLElement>('.dock-wait')!;
      const queueing = showQueue(dock, owner);
      wait.hidden = panel.parentElement === dock || queueing;
      wait.textContent = busy || state.phase !== 'player' ? 'En acción…' : owner.hp === 0 ? 'Fuera de combate' : `Turno de ${state.allies[state.active].name}`;
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
      const off = !mine || busy || targeting || callbacks.waiting(owner.id);
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
      const home = isSplit || (state.allies[state.active] === c) ? dockOf(c.id).querySelector('.dock-plate')! : roster;
      if (card.parentElement !== home) home.append(card);
      if (card.dataset.anima !== (c.classId ?? 'none')) dress(card, c);
      card.classList.toggle('is-active', state.phase === 'player' && state.allies[state.active].id === c.id);
      card.classList.toggle('is-down', shownHp(c) === 0);
      card.classList.toggle('is-acting', root.dataset.actor === c.id);
      const boost = card.querySelector<HTMLElement>('.unit-boost')!;
      boost.hidden = !boostRounds(state) || c.hp === 0;
      boost.textContent = `▲ ${boostRounds(state)}`;
      boost.title = SKILLS.filter(skill => boostRounds(state!, skill.id)).map(skill => `${skill.name}: ${boostedStats(skill.id)} +${state!.boosts![skill.id]!.amount}`).join(' · ');
      card.querySelector('.unit-status')!.textContent = c.hp === 0 ? 'FUERA' : c.guarding ? 'EN GUARDIA' : state.allies[state.active].id === c.id && state.phase === 'player' ? 'ACTIVO' : '';
      setVitals(card.querySelector('.vitals')!, shownHp(c), c.maxHp, c.secondary, animaMax(c));
      const plate = root.querySelector(`.battle-target[data-target="${c.id}"]`);
      if (plate) fill(plate.querySelector('.enemy-health')!, shownHp(c) / c.maxHp);
      const platePips = plate?.querySelector<HTMLElement>('.plate-pips');
      if (platePips && platePips.childElementCount !== c.maxSecondary) platePips.innerHTML = '<i data-pip="full"></i>'.repeat(c.maxSecondary);
      platePips?.toggleAttribute('hidden', !animaMax(c));
      plate?.querySelectorAll<HTMLElement>('.plate-pips i').forEach((pip, i) => { pip.dataset.pip = i < c.secondary ? 'full' : 'spent'; });
      if (plate && !unlanded) showStatuses(plate, c);
    }
    const order = state.allies.map(c => root.querySelector(`.party-card[data-unit="${c.id}"]`)!).filter(card => card.parentElement === roster);
    if (order.some((card, i) => roster.children[i] !== card)) order.forEach(card => roster.append(card));
    for (const foe of state.foes) {
      const plate = get<HTMLButtonElement>(`.battle-target[data-target="${foe.id}"]`);
      fill(plate.querySelector('.enemy-health')!, shownHp(foe) / foe.maxHp);
      if (!unlanded) showStatuses(plate, foe);
      const health = foe.hp === 0 ? 'fuera de combate' : foe.hp === foe.maxHp ? 'salud completa' : foe.hp / foe.maxHp <= .3 ? 'salud baja' : 'herido';
      plate.setAttribute('aria-label', `Elegir a ${foe.name}, ${health}`);
      plate.classList.toggle('is-down', shownHp(foe) === 0);
      plate.classList.toggle('is-acting', root.dataset.actor === foe.id);
    }
    // Possessed dogs surround the party: Huir stays greyed out. A turn waiting for player 2 locks every command.
    articles.forEach(article => { article.querySelector<HTMLButtonElement>('.command-trigger')!.disabled = blocked(article.dataset.command as Command); });
    showElements();
    const eligible = targeting && !busy && state.phase === 'player' ? validTargets(state, selected === 'dual' ? 'attack' : selected!, selectedSkill).map(c => c.id) : [];
    root.querySelectorAll<HTMLButtonElement>('[data-target]').forEach(button => {
      button.disabled = !eligible.includes(button.dataset.target!);
      if (button.classList.contains('battle-target')) button.tabIndex = button.disabled ? -1 : 0;
      if (button.classList.contains('roster-target')) button.hidden = !targeting;
      button.closest('[data-unit]')?.classList.toggle('is-eligible', !button.disabled);
    });
    get('.command-deck').hidden = targeting;
    get('.target-picker').hidden = !targeting;
    // Keys for the device in use (input-glyphs.ts fills the template).
    get('.command-help').dataset.glyphTemplate = targeting ? '{arrows} elegir · {confirm} aplicar · {cancel} volver'
      : selected === 'skill' || selected === 'dual' ? '{updown} elegir · {confirm} usar · {details} detalles · {cancel} volver'
      : `{${COMMANDS.length > 4 ? 'pickDev' : 'pick'}} elegir · {confirm} confirmar · {prev} {next} ánima${elementsFor(state, actor).length ? ' · {element} elemento' : ''} · {cancel} volver`;
    get('.flyout-hint').toggleAttribute('hidden', detailsLearned);
    get('.battle-bottom').hidden = ended;
    get('.battle-result').hidden = !ended;
    if (ended) {
      get('.battle-result h2').textContent = state.phase === 'won' ? '¡Camino libre!' : state.phase === 'escaped' ? 'Seguimos.' : state.encounter === 'palace-guards' ? 'Demasiado fuertes.' : 'Un respiro.';
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
    renderSummary();
    armDualBanner();
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
    const growth = won ? award(who.map(p => p.id), gained, xpBefore, state!.levels ?? {}) : [];
    result.toggleAttribute('data-rewards', !!growth.length);
    total.hidden = !won || !gained;
    total.querySelector('strong')!.textContent = `+${gained} EXP`;
    list.hidden = !growth.length;
    if (!growth.length || !state) { list.replaceChildren(); return; }
    const names = (ids: string[]) => ids.map(id => state!.allies.find(a => a.id === id)?.name ?? id).join(' · ');
    list.innerHTML = growth.map((g, i) => {
      const wearers = who.find(p => p.id === g.id)!.wearers, grown = wearers.some(id => grownUp(state!.allies.find(a => a.id === id)!.profile));
      return `<li class="xp-card" data-anima="${g.id}" style="--chip:${CLASSES[g.id].colour};--i:${i};--fill:${levelProgress(g.xpBefore)}">
        <div class="xp-head"><strong>${animaOf(g.id, grown).name}</strong><small>${names(wearers)}</small></div>
        <div class="xp-row"><span class="xp-level">NIVEL <b>${g.levelBefore}</b></span><span class="xp-count">${g.levelBefore >= MAX_LEVEL ? 'MÁXIMO' : `+${g.xpAfter - g.xpBefore} EXP`}</span></div>
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
        const level = Math.max(g.levelBefore, Math.min(g.levelAfter, levelForXp(xp)));
        cards[i].style.setProperty('--fill', String(level >= MAX_LEVEL ? 1 : levelProgress(xp)));
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
  const LEVEL_HOLD = 900, REVEAL_MS = 2100, REVEAL_MORE = 700;
  interface Reveal { skills: (typeof SKILLS[number])[]; anima: string; who: string; level: number; colour: string; id: ClassId }
  let rewardToken = 0, filling = false, revealing = false, reveals: Reveal[] = [];
  let rewardTimer: ReturnType<typeof setTimeout> | undefined, revealTimer: ReturnType<typeof setTimeout> | undefined;
  const holdingRewards = () => get('.battle-result').hasAttribute('data-holding');
  /** Whatever the last victory screen had going stops: a new one, or the fight closing. */
  function resetRewards() {
    rewardToken++; cancelAnimationFrame(rewardFrame); clearTimeout(rewardTimer); clearTimeout(revealTimer);
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
  /** What each level taught takes the screen, one ánima after another: REVEAL_MS, and REVEAL_MORE for each skill past the first (`revealSkill`). */
  function nextReveal(token: number) {
    if (token !== rewardToken) return;
    const band = get('.skill-reveal'), result = get('.battle-result'), next = reveals.shift();
    if (!next) { revealing = false; delete result.dataset.revealing; settleRewards(token); return; }
    revealing = true; result.dataset.revealing = '';
    revealSkill(band, next);
    revealTimer = setTimeout(() => {
      if (token !== rewardToken) return;
      band.dataset.leaving = '';
      revealTimer = setTimeout(() => { if (token !== rewardToken) return; band.hidden = true; delete band.dataset.leaving; nextReveal(token); }, 320);
    }, REVEAL_MS + (next.skills.length - 1) * REVEAL_MORE);
  }
  /**
   * What a level taught has the screen for a moment: a band across it in its ánima's colour,
   * «HABILIDAD NUEVA» (or «HABILIDADES NUEVAS»), who learned it at which level, and each skill's name
   * landing with a glint, one after the other, with what it does and its maná; rays turn behind it and
   * it has its own sound (`skill-learned`). The card keeps «Aprende …» after it.
   */
  function revealSkill(band: HTMLElement, { skills, anima, who, level, colour, id }: Reveal) {
    band.dataset.anima = id; band.dataset.count = String(skills.length); band.style.setProperty('--chip', colour);
    band.querySelector('.battle-kicker')!.textContent = skills.length > 1 ? 'HABILIDADES NUEVAS' : 'HABILIDAD NUEVA';
    band.querySelector('.skill-reveal-who')!.textContent = [anima, `nivel ${level}`, who].filter(Boolean).join(' · ');
    band.querySelector('.skill-reveal-skills')!.innerHTML = skills.map((skill, i) => `<div class="skill-reveal-skill" style="--k:${i}"><h2>${escapeHtml(skill.name)}</h2><p>${escapeHtml(skill.description)}</p><strong class="skill-reveal-cost">MANÁ ${costPips(skill.cost)}</strong></div>`).join('');
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
    if (level >= MAX_LEVEL) card.querySelector('.xp-count')!.textContent = 'MÁXIMO';
    const learned = SKILLS.filter(skill => g.learned.includes(skill.id) && 'level' in skill && skill.level <= level);
    if (!learned.length) return;
    const line = card.querySelector<HTMLElement>('.xp-learn')!;
    line.innerHTML = 'Aprende <strong></strong>';
    line.querySelector('strong')!.textContent = learned.map(skill => skill.name).join(' y ');
    line.hidden = false;
    const anima = card.querySelector('.xp-head strong')?.textContent ?? '', who = card.querySelector('.xp-head small')?.textContent ?? '';
    const fresh = learned.filter(skill => 'level' in skill && skill.level === level);
    if (fresh.length) reveals.push({ skills: fresh, anima, who, level, colour: CLASSES[g.id].colour, id: g.id });
    if (!revealing) nextReveal(token);
  }
  function collapse(restoreFocus = false) {
    const old = selected; selected = undefined; selectedSkill = undefined; selectedDual = undefined; targeting = false;
    highlight(); delete root.dataset.targeting;
    root.querySelectorAll<HTMLButtonElement>('[data-target]').forEach(button => {
      button.disabled = true;
      button.closest('[data-unit]')?.classList.remove('is-eligible');
    });
    get('.command-deck').hidden = false; get('.target-picker').hidden = true;
    root.querySelectorAll<HTMLElement>('.roster-target').forEach(button => { button.hidden = true; button.closest('[data-unit]')?.classList.remove('is-eligible'); });
    articles.forEach(article => article.classList.remove('expanded'));
    root.querySelectorAll('[data-command="skill"] .command-trigger, [data-command="dual"] .command-trigger').forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
    delete panel.dataset.flyout; delete panel.dataset.sheet; get('.skill-flyout').inert = true;
    showDetails(false);
    if (restoreFocus && old) get<HTMLButtonElement>(`[data-command="${old}"] .command-trigger`).focus();
  }
  function highlight(id?: string) {
    callbacks.target(id);
    root.querySelectorAll<HTMLElement>('[data-unit], [data-target]').forEach(el => {
      el.classList.toggle('is-targeted', !!id && (el.dataset.unit === id || el.dataset.target === id));
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
    if (!state || busy || state.phase !== 'player' || !split()) return;
    const active = state.allies[state.active], partner = dualPartner(state);
    if (!partner || callbacks.driver(partner.id) === callbacks.driver(active.id) || callbacks.waiting(partner.id) || callbacks.waiting(active.id)) return;
    return partner;
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
    if (m.level === 'skill') return skillsFor(s, owner).map(skill => {
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
  function queueBack() {
    const m = queueMenu;
    if (!m || m.level === 'root') return;
    const skills = state ? skillsFor(state, state.allies.find(a => a.id === m.ally)!) : [];
    if (m.level === 'target' && m.action === 'skill') Object.assign(m, { level: 'skill', cursor: Math.max(0, skills.findIndex(x => x.id === m.skill)) });
    else Object.assign(m, { level: 'root', cursor: m.action === 'skill' ? 1 : 0, action: undefined, skill: undefined });
    callbacks.sound('ui-back'); render();
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
  /** A press from a player whose turn it is not: it goes to their move ready ahead, if they have one to get ready. Returns whether it was theirs. */
  function queueControl(action: ControlAction | 'prev' | 'next', player: PlayerId) {
    if (!state || !['player', 'enemy'].includes(state.phase)) return false;
    const owner = state.allies.find(a => callbacks.driver(a.id) === player && (state!.queued?.[a.id] || queueOwner() === a));
    if (!owner) return false;
    if (state.queued?.[owner.id]) {
      // Ready: confirm opens the choice again (while it can still be changed), cancel takes it back.
      if (action === 'cancel') unqueue(owner);
      else if (action === 'confirm' && queueOwner() === owner) unqueue(owner, true);
      return true;
    }
    const m = queueMenu;
    if (!m || m.ally !== owner.id) return true;
    // Aitor's dock is mirrored: going back is to the right there.
    const flipped = dockOf(owner.id).dataset.dock === '2';
    if (action === 'confirm') queuePick(owner);
    else if (action === 'cancel' || (action === 'left' && !flipped) || (action === 'right' && flipped)) queueBack();
    else if (action === 'up' || action === 'down') {
      const count = queueItems(owner).length;
      if (count) { m.cursor = (m.cursor + (action === 'up' ? -1 : 1) + count) % count; callbacks.sound('ui-move'); render(); }
    }
    return true;
  }
  /** X from a player whose turn it is not, on the Atacar of their move ready ahead: its next element. Returns whether it was theirs. */
  function queueElement(player: PlayerId) {
    const m = queueMenu, owner = m && state?.allies.find(a => a.id === m.ally);
    if (!state || !m || !owner || callbacks.driver(owner.id) !== player || m.level !== 'root' || queueItems(owner)[m.cursor]?.id !== 'attack') return false;
    return nextElement(owner);
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
  const manaIn = (c: Combatant, option: ReturnType<typeof dualOptions>[number]) => c === option.holder && option.wear ? c.mana?.[option.wear] ?? manaMax(state?.improved, option.wear) : c.secondary;
  /** A dual's halves, Matemágico's first (the banner's left, its navy half). */
  const halves = (dual: DualSpec) => [...dual.parts].map(id => SKILLS.find(x => x.id === id)!).sort((x, y) => Number(y.class === 'matemagico') - Number(x.class === 'matemagico'));
  /** The combined cost: one group of circles per half, each in its ánima's colour, under whoever pays it. */
  function dualPips(dual: DualSpec, who: (id: ClassId) => string) {
    const cost = dualCost(dual);
    return `<span class="dual-pips">${halves(dual).map(x => `<span class="dual-pip-group" style="--chip:${CLASSES[x.class].colour}"><small>${escapeHtml(who(x.class))}</small><span>${'<i></i>'.repeat(cost[x.id] ?? 0)}</span></span>`).join('<b>+</b>')}</span>`;
  }
  const dualTotal = (dual: DualSpec) => `${halves(dual).map(x => dualCost(dual)[x.id] ?? 0).join(' + ')} maná`;
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
    if (!state || busy) return;
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
    banner.querySelector('h2')!.textContent = spec.name;
    banner.querySelector('.dual-halves')!.innerHTML = halves(spec).map(x => `<div class="dual-half" data-anima="${x.class}" style="--chip:${CLASSES[x.class].colour}"><span class="battle-kicker">${escapeHtml(brought(x.class)?.name.toUpperCase() ?? '')}</span><strong>${escapeHtml(x.name)}</strong><span class="dual-pips"><span class="dual-pip-group"><span>${'<i></i>'.repeat(dualCost(spec)[x.id] ?? 0)}</span></span></span></div>`).join('');
    banner.querySelector('.dual-total')!.textContent = dualTotal(spec);
    banner.querySelector('footer p')!.textContent = spec.description;
    clearTimeout(bannerTimer); clearTimeout(compactTimer);
    for (const key of ['leaving', 'compact', 'armed', 'fire']) delete banner.dataset[key];
    const bars = get('.dual-cinema'); bars.hidden = true; delete bars.dataset.leaving;
    banner.hidden = true; void banner.offsetWidth; banner.hidden = false;
    return banner;
  }
  /** The dual the target picker would set off now: the skill picked completing the partner's queued half, or (development) the Dual command's. */
  function aimedDual() {
    const s = state;
    if (!s || !targeting || busy || s.phase !== 'player') return;
    if (selected === 'dual') return DUALS.find(d => d.id === selectedDual);
    if (selected === 'skill' && selectedSkill) return queuedDual(s, selectedSkill);
  }
  /**
   * While a dual is being aimed, its banner is already up, whole, its two halves meeting in the middle
   * (`data-armed`). The skill list gave nothing away: the dual shows the moment its skill is picked.
   * Backing out, or the partner taking their half back, puts it away.
   */
  function armDualBanner() {
    const s = state, banner = get('.dual-banner');
    if (!s || busy) return;
    const spec = aimedDual(), up = !banner.hidden && !banner.dataset.leaving;
    if (!spec) { if (up && banner.dataset.armed) hideDualBanner(); return; }
    if (up && banner.dataset.armed === spec.id) return;
    const pair = [s.allies[s.active], dualPartner(s)];
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
    if (armed) { clearTimeout(bannerTimer); clearTimeout(compactTimer); delete banner.dataset.armed; } else banner = fillDualBanner(spec, brought);
    banner.dataset.fire = 'true';
    const bars = get('.dual-cinema'); delete bars.dataset.leaving; bars.hidden = true; void bars.offsetWidth; bars.hidden = false;
    // Then only its name stays, so the rest of the move (and whoever is on top of a tall foe) shows. Read while it was aimed, sooner.
    compactTimer = setTimeout(() => { banner.dataset.compact = 'true'; }, (seen || armed ? seconds : seconds + .6) * 1000);
    slowDown(seconds);
    // Both docks light up in their own ánima's colour.
    for (const id of d.actors) { const ally = s.allies.find(a => a.id === id); if (ally?.classId) flashAnima(dockOf(id), CLASSES[ally.classId].colour); }
    return wait(seconds * 1000);
  }
  function hideDualBanner() {
    const banner = get('.dual-banner'), bars = get('.dual-cinema');
    if (banner.hidden) return;
    banner.dataset.leaving = 'true';
    if (!bars.hidden) bars.dataset.leaving = 'true';
    clearTimeout(bannerTimer); clearTimeout(compactTimer); bannerTimer = setTimeout(() => {
      banner.hidden = true; bars.hidden = true; delete bars.dataset.leaving;
      for (const key of ['leaving', 'compact', 'armed', 'fire']) delete banner.dataset[key];
    }, 300);
  }
  /**
   * Vertitrón's moves, shouted by Uri from up on it, in a bubble over him (he plays it like a video
   * game): «¡Pisotón!», «¡Barrido!», «¡Grito liberador!», and the charge before «¡Rayo terrorífico!».
   */
  function shout(effect: BattleEffect) {
    const s = state;
    if (!s || effect.kind !== 'enemy' || !effect.ability || s.foes.find(f => f.id === effect.actor)?.kind !== 'vertigo') return;
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
  }
  /** One action on screen: a dual's banner first (or Uri's shout, from up on Vertitrón), then the action itself. */
  async function play(effect: BattleEffect, token: number) {
    // A banner aimed for a dual that did not happen (its half no longer there) goes.
    if (!effect.dual && get('.dual-banner').dataset.armed) hideDualBanner();
    const banner = effect.dual ? showDualBanner(effect) : undefined;
    shout(effect);
    await Promise.all([present(effect, token), banner]);
    if (banner) hideDualBanner();
    if (token === generation) remark(effect);
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
    if (state.phase === 'player') collapse();
    busy = true;
    try { await flushNews(token); } finally { newsPlaying = false; }
    if (token !== generation || !state) return;
    busy = false; render();
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
    panel.dataset.flyout = 'open'; panel.dataset.sheet = command; get('.skill-flyout').inert = false;
    // The sheet slides out of its command and grows upwards from its bottom edge, over the scene, so
    // nothing else in the dock moves however many skills it holds.
    panel.style.setProperty('--flyout-bottom', `${get('.command-deck').getBoundingClientRect().bottom - get(`[data-command="${command}"]`).getBoundingClientRect().bottom}px`);
    if (command === 'dual') fillDuals(); else fillSkills();
    render();
    (skillButtons().find(b => !b.hasAttribute('aria-disabled')) ?? skillButtons()[0] ?? get<HTMLButtonElement>('.skill-flyout .command-back')).focus({ preventScroll: true });
  }
  /** The flyout's sheet: the active fighter's skills right now (an ánima swap refills it). */
  function fillSkills() {
    if (!state) return;
    const actor = state.allies[state.active];
    get('.skill-flyout .battle-kicker').textContent = `HABILIDADES · ${actor.name.toUpperCase()}${actor.classId ? ` · ${animaOf(actor.classId, grownUp(actor.profile)).name.toUpperCase()}` : ''}`;
    // Unaffordable skills stay focusable so their details can still be read.
    get('.skill-list').innerHTML = skillsFor(state, actor).map((skill, i) => {
      const affordable = actor.secondary >= skill.cost;
      const available = validTargets(state!, 'skill', skill.id).length > 0;
      const reason = !affordable ? 'Sin maná' : available ? costPips(skill.cost) : skill.kind === 'boost' ? 'En marcha' : 'Sin objetivo';
      return `<button type="button" data-skill="${skill.id}" data-class="${skill.class}" ${!affordable || !available ? 'aria-disabled="true"' : ''} style="--i:${i}"><span class="skill-key">${i + 1}</span><span class="skill-name"><strong>${skill.name}</strong><small>${TARGETS[skill.side]}</small></span><small class="skill-cost">${reason}</small></button>`;
    }).join('') || '<p class="skill-empty">Sin habilidades con esta ánima.</p>';
    fitSkills();
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
    if (!state || busy || targeting || state.phase !== 'player' || callbacks.waiting(state.allies[state.active].id)) return;
    const actor = state.allies[state.active];
    const next = typeof choice === 'number' ? switchAnima(state, choice) : wearAnima(state, choice) ? choice : undefined;
    const dock = dockOf(actor.id), switcher = dock.querySelector<HTMLElement>('.anima-switch')!;
    switcher.classList.remove('is-stuck'); void switcher.offsetWidth;
    if (!next) { callbacks.sound('denied'); switcher.classList.add('is-stuck'); return; }
    callbacks.sound('anima-swap');
    const putOn = () => {
      callbacks.anima(actor.id, next);
      showDetails(false);
      render();
      flashAnima(root.querySelector(`.party-card[data-unit="${actor.id}"] .vitals-avatar`), CLASSES[next].colour);
      if (selected === 'skill' || selected === 'dual') {
        if (selected === 'dual') fillDuals(); else fillSkills();
        (skillButtons().find(b => !b.hasAttribute('aria-disabled')) ?? skillButtons()[0] ?? get<HTMLButtonElement>('.skill-flyout .command-back')).focus({ preventScroll: true });
      }
    };
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { putOn(); return; }
    // The browser keeps a picture of the old interface, so it leaves in its own look with the ánima
    // already changed and nothing waiting. Aitor's dock mirrors it, as it does everything else.
    document.documentElement.style.setProperty('--swap-way', mirrored() ? '-1' : '1');
    dock.classList.add('is-swapping');
    const swap = lastSwap = document.startViewTransition(putOn);
    void swap.finished.finally(() => { if (lastSwap === swap) dock.classList.remove('is-swapping'); });
  }
  function beginTargeting(skill?: SkillId) {
    if (!state || busy || !selected) return;
    if (skill && (state.allies[state.active].secondary < SKILLS.find(s => s.id === skill)!.cost || !validTargets(state, 'skill', skill).length)) return;
    showDetails(false);
    // A skill that reaches the whole party has nobody to pick: it happens at once.
    if (skill && !aimed(skill)) { selectedSkill = skill; void execute(); return; }
    selectedSkill = skill; targeting = true;
    // A cure is aimed at the party: their cards and plates are what is picked.
    const cure = !!skill && SKILLS.find(s => s.id === skill)!.side === 'allies';
    root.dataset.targeting = cure ? 'allies' : 'foes';
    get('.target-picker h2').textContent = skill ? SKILLS.find(s => s.id === skill)!.name : selected === 'dual' ? DUALS.find(d => d.id === selectedDual)?.name ?? 'Dual' : attackName(state.allies[state.active]);
    const standing = state.foes.filter(f => f.hp > 0);
    get('.target-picker p').textContent = cure ? 'Elige a quién curar.' : FEAR_KICKERS[state.encounter as keyof typeof FEAR_KICKERS] ? standing.length === 1 ? `Elige a ${standing[0].name}.` : 'Elige un enemigo.' : state.encounter === 'palace-minion' ? 'Elige al esbirro.' : state.encounter === 'palace-guards' ? 'Elige un guardián.' : 'Elige un perro en la calle.';
    render();
    targetButtons()[0]?.focus({ preventScroll: true });
  }
  function back() {
    if (busy) return;
    if (details) { showDetails(false); return; }
    if (targeting && selected === 'skill') {
      const oldSkill = selectedSkill;
      collapse(); choose('skill');
      root.querySelector<HTMLButtonElement>(`[data-skill="${oldSkill}"]`)?.focus({ preventScroll: true });
    } else if (targeting && selected === 'dual') {
      const oldDual = selectedDual;
      collapse(); choose('dual');
      root.querySelector<HTMLButtonElement>(`[data-dual="${oldDual}"]`)?.focus({ preventScroll: true });
    } else { collapse(true); render(); }
  }
  async function present(effect: BattleEffect, token: number) {
    if (!state) return;
    root.dataset.resolving = 'true';
    root.dataset.actor = effect.actor;
    root.querySelectorAll<HTMLElement>('[data-unit]').forEach(card => card.classList.toggle('is-acting', card.dataset.unit === effect.actor));
    articles.forEach(article => { article.querySelector<HTMLButtonElement>('.command-trigger')!.disabled = true; });
    get('.turn-meta').textContent = 'EN ACCIÓN';
    // A flurry on one target (Zarpazos' claws, Foc Binari's zero and one): each blow takes its own PV
    // off the bar and shows its own number as it lands, and a fire it carries catches with the blow
    // that lit it; whatever else it says comes with the last one.
    const strikes = effect.target && !effect.hits && (effect.strikes?.length ?? 1) > 1 ? effect.strikes! : undefined;
    // What the action is called on its numbers: the party's skill or dual. A foe's ability is never named.
    const label = effect.kind === 'enemy' ? '' : effect.release?.name ?? effect.dual?.name ?? SKILLS.find(s => s.id === effect.skill)?.name ?? (effect.element ? ELEMENTS[effect.element].name : '');
    const spread = (blow: number) => strikes ? (blow / (strikes.length - 1) - .5) * 48 : 0;
    // Statuses that landed show a beat after the last blow.
    const landed: { target: string; id: string; text: string; detail: string }[] = [];
    // After a wound opened (its own pop comes first), a little later.
    let wounded = false;
    const stamp = () => landed.forEach(l => setTimeout(() => { if (token === generation) pop(l.target, l.text, 'status', l.detail, l.id); }, wounded ? 560 : 170));
    let say = '';
    const hurtPop = (id: string, amount: number, detail: string, dx?: number) => pop(id, `−${amount}`, 'damage', detail, undefined, dx);
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
    await callbacks.change(state, effect, blow => {
      if (token !== generation || !state) return;
      if (blow) {
        if (strikes?.[blow] === undefined) return;
        owed.set(effect.target!, Math.max(0, (owed.get(effect.target!) ?? 0) - strikes[blow]));
        landFire(blow);
        render(); knock();
        const last = blow === strikes.length - 1;
        hurtPop(effect.target!, strikes[blow], last && say !== label ? say : '', spread(blow));
        if (last) stamp();
        return;
      }
      // Its first blow lands: everything comes off but a flurry's other blows.
      unlanded = false;
      owed.clear();
      if (strikes) owed.set(effect.target!, strikes.slice(1).reduce((sum, amount) => sum + amount, 0));
      landFire(0);
      render(); knock();
      const target = [...state.allies, ...state.foes].find(c => c.id === (effect.target ?? effect.actor));
      // What went up or down, a moment after the blow's own number (a boost already says it).
      if (!effect.boosted) effect.stats?.forEach(change => setTimeout(() => pop(change.target, `${statNames(change.stats)} ${change.way === 'down' ? '▼' : '▲'}`, change.way === 'down' ? 'stat-down' : 'stat-up'), 420));
      if (effect.kind === 'defend') pop(effect.actor, 'En guardia', 'guard', effect.charged ? `Maná +${effect.charged}` : '');
      else if (effect.boosted && effect.skill) { const skill = effect.skill; effect.boosted.forEach(id => pop(id, SKILLS.find(s => s.id === skill)!.name.split(' ')[0], 'guard', `${boostedStats(skill)} +${state!.boosts?.[skill]?.amount ?? 0}`)); }
      else if (effect.swallowed && effect.target) pop(effect.target, '0', 'guard', '¡Se lo traga!');
      else if (effect.healedAll) effect.healedAll.forEach(h => pop(h.target, `+${h.amount}`, 'heal', label));
      else if (effect.healed && effect.target) pop(effect.target, `+${effect.amount ?? 0}`, 'heal', label);
      // A skill that only leaves a status (Rayo de sanación, Confusión, Rayo encogedor) says so below, with no number.
      else if (effect.regen || effect.afflicted) { /* its status pops below */ }
      else if (effect.hits) effect.hits.forEach(h => pop(h.target, `−${h.amount}`, 'damage', h.peeled ? peelText(h.peeled, state!.foes.find(f => f.id === h.target)) : label));
      else if (effect.target && target) {
        // A big onion's weight falls on the others as well.
        effect.splash?.forEach(other => pop(other.target, `−${other.amount}`, 'damage', isOnion(state!.foes.find(f => f.id === effect.actor)?.kind) ? '¡Qué peso!' : ''));
        say = target.hp === 0 ? '¡Fuera!' : effect.confused ? 'Confundido' : effect.melted ? '¡Se derrite!' : effect.peeled ? peelText(effect.peeled, target) : target.guarding ? 'Protegido' : label;
        // A flurry's first blow carries the skill's name; the others follow as they land (above).
        if (strikes) hurtPop(effect.target, strikes[0], label, spread(0));
        else hurtPop(effect.target, effect.amount ?? 0, say);
      }
      // A physical blow on someone bleeding spent it: how much harder it landed, in Sangrado's red.
      const wounds = [...effect.bled && effect.target ? [{ target: effect.target, bled: effect.bled }] : [], ...(effect.hits ?? []).flatMap(h => h.bled ? [{ target: h.target, bled: h.bled }] : [])];
      wounded = wounds.length > 0;
      wounds.forEach(w => setTimeout(() => { if (token === generation) pop(w.target, `+${Math.round((woundScale(w.bled, effect.skill) - 1) * 100)}%`, 'status', 'Sangrado', 'sangrado'); }, 60));
      // Whatever status landed says so on its own, in its colour, a beat after the number: ¡Quemado!, ¡Sangrado!…
      if (effect.burn && effect.target && !effect.burns) landed.push({ target: effect.target, id: effect.burn.id, text: `¡${TIMED[effect.burn.id].name}${effect.burn.level > 1 ? ` ${roman(effect.burn.level)}` : ''}!`, detail: effect.burn.level > 1 ? 'El fuego sube' : '' });
      if (effect.status && effect.target) landed.push({ target: effect.target, id: effect.status.id, text: `¡${STATUSES[effect.status.id].name}!`, detail: `× ${effect.status.stacks}` });
      // Tecnópata's: a cure or a status on the clock, seconds added to what was running, the blinding, the fire Rayo solar leaves.
      for (const on of [effect.regen, effect.afflicted]) if (on && effect.target) landed.push({ target: effect.target, id: on.id, text: `¡${TIMED[on.id].name}${on.level > 1 ? ` ${roman(on.level)}` : ''}!`, detail: `${TIMED[on.id].seconds} s` });
      if (effect.extended && effect.target) effect.extended.statuses.forEach(id => landed.push({ target: effect.target!, id, text: `+${effect.extended!.seconds} s`, detail: TIMED[id].name }));
      effect.blinded?.forEach(id => landed.push({ target: id, id: 'cegado', text: `¡${TIMED.cegado.name}!`, detail: '1 ronda' }));
      effect.hits?.forEach(h => { if (h.burn) landed.push({ target: h.target, id: h.burn.id, text: `¡${TIMED[h.burn.id].name} ${roman(h.burn.level)}!`, detail: '' }); });
      if (effect.exploded) landed.push({ target: effect.actor, id: 'explosion', text: 'Pierde su turno', detail: 'Bip se recompone' });
      if (effect.charging) landed.push({ target: effect.charging, id: 'carga', text: '¡Cargado!', detail: 'Sale al empezar la ronda' });
      effect.hits?.forEach(h => { if (h.status) landed.push({ target: h.target, id: h.status.id, text: `¡${STATUSES[h.status.id].name}!`, detail: `× ${h.status.stacks}` }); });
      // What the element turned: what it leaves, in its colour, and any PV it takes, on top of the blow's own number.
      const reaction = effect.reaction;
      if (reaction && effect.target) {
        const says = { humo: { id: 'cegado', text: `¡${TIMED.cegado.name}${(reaction.level ?? 1) > 1 ? ` ${roman(reaction.level!)}` : ''}!`, detail: 'Se apaga el fuego' }, cauterizado: { id: 'cauterizado', text: '¡Cauterizado!', detail: `Sangrado × ${reaction.stacks ?? 0}` }, tormenta: { id: 'tormenta', text: '¡Tormenta!', detail: 'Salta por el humo' } }[reaction.id];
        landed.push({ target: effect.target, ...says });
        reaction.hits?.forEach((h, i) => setTimeout(() => { if (token === generation) pop(h.target, `−${h.amount}`, 'damage', says.text.replace(/[¡!]/g, ''), undefined, 58); }, 140 + i * 90));
      }
      // Punto débil: left on the target, or spent by this blow (it landed WEAK_SPOT times as hard).
      const spentOn = [...markSpent(effect) && effect.target && !effect.hits ? [effect.target] : [], ...(effect.hits ?? []).filter(h => h.weakSpot).map(h => h.target)];
      if (markLeft(effect) && effect.target) landed.push({ target: effect.target, id: 'punto-debil', text: '¡Punto débil!', detail: `×${WEAK_SPOT} al siguiente golpe` });
      spentOn.forEach(id => landed.push({ target: id, id: 'punto-debil', text: `×${WEAK_SPOT}`, detail: 'Punto débil' }));
      if (!strikes) stamp();
    });
    // A blow the scene never got to (the fight cut short) still comes off.
    if (owed.size || heldFire.size || unlanded) { owed.clear(); heldFire.clear(); unlanded = false; if (token === generation && state) render(); }
    if (token === generation) { delete root.dataset.resolving; delete root.dataset.actor; }
  }
  /**
   * The confirm: the action goes off (`commit`: if the next fighter has a skill ready that makes a
   * dual with this one, the dual, by surprise). Then, while the next fighter has a move ready, it
   * plays on its own, its plate flashing first; one that can no longer be (its target fell, no
   * maná) is dropped and they choose again. Once the party is through, the foes act and the round ends.
   */
  async function execute(target?: string) {
    if (!state || !selected || busy) return;
    if ((selected === 'attack' || selected === 'dual' || (selected === 'skill' && (!selectedSkill || aimed(selectedSkill)))) && !targeting) return;
    const first = holdBack(() => selected === 'dual' ? selectedDual ? actDual(state!, selectedDual, target) : undefined : commit(state!, selected!, target, selectedSkill));
    if (!first) return;
    const token = generation;
    // Shown at once: a dual took the partner's turn too, and their move ready ahead is gone with it.
    busy = true; stale = undefined; collapse(); render(); root.focus({ preventScroll: true });
    // The tempo (battle-motion `holdAfter`): before anyone else moves, what this action changed gets
    // its moment on screen (a fire lit, stats down, someone falling); otherwise only a short breath.
    const down = (e: BattleEffect) => !!e.target && [...state!.allies, ...state!.foes].some(c => c.id === e.target && c.hp === 0);
    let last = first;
    await play(first, token);
    if (token !== generation || !state) return;
    await flushNews(token);
    while (token === generation && state && state.phase === 'player' && state.queued?.[state.allies[state.active].id]) {
      const ally = state.allies[state.active];
      await wait(holdAfter(last, down(last), repeatedDuals.has(last)));
      if (token !== generation || !state) return;
      // Taken back while the other one's move played.
      if (!state.queued?.[ally.id]) break;
      const text = queuedText(state.queued[ally.id]!, ally), choice = takeQueued(state);
      if (!choice) { stale = ally.id; break; }
      // Its plate stays (and the commands hidden) until the move has played: they are not choosing.
      firing = { id: ally.id, text }; render();
      await wait(BEAT.queue);
      if (token !== generation || !state) return;
      const next = holdBack(() => act(state!, choice.action, choice.target, choice.skill));
      if (!next) { firing = undefined; stale = ally.id; break; }
      last = next;
      await play(next, token);
      firing = undefined;
      if (token !== generation || !state) return;
      await flushNews(token);
    }
    if (token !== generation || !state) return;
    // Round after round while nobody in the party can choose (Explosión: Aitor sits one out with Gerard down).
    while (state.phase === 'enemy') {
      const [plan] = await Promise.all([planEnemyTurn(state), wait(holdAfter(last, down(last), repeatedDuals.has(last)))]);
      if (token !== generation || !state) return;
      // Each foe standing, in order, once (a part, Vertitrón's eye, has no turn).
      const tried = new Set<string>();
      for (;;) {
        // A fire may have ended the fight while the foes were acting.
        if ((state.phase as BattleState['phase']) !== 'enemy') break;
        const foe = state.foes.find(f => f.hp > 0 && !tried.has(f.id) && !state!.enemyActions.includes(f.id));
        if (!foe) break;
        tried.add(foe.id);
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
      const release = state.news?.find(news => news.release);
      if (release) holdFrom(before, release); else void callbacks.change(state);
      queueMenu = undefined; stale = undefined;
      if (ticks.length) {
        // The round's end: what keeps hurting hurts now, one after another.
        render();
        for (const tick of ticks) { callbacks.sound('bleed'); pop(tick.target, `−${tick.amount}`, 'damage', STATUSES[tick.status].name); await wait(380); }
        if (token !== generation || !state) return;
      }
      await flushNews(token);
      if (token !== generation || !state) return;
    }
    busy = false; render();
    if (state.phase === 'player') focusFirst();
  }
  /** The fight as it was opened, to fight it again from the start (`close('retry')`). */
  let reopen: (() => void) | undefined;
  /** Ends the fight; after a fall, `retry` opens it again from the start and `rewind` leaves it as if it never began. */
  function close(after?: 'retry' | 'rewind') {
    const again = after === 'retry' ? reopen : undefined;
    if (after) callbacks.fallen?.(after);
    generation++; state = undefined; busy = false; summaryOpen = false; queueMenu = undefined; firing = undefined; stale = undefined; slowUntil = 0; get('.dual-banner').hidden = true; get('.dual-cinema').hidden = true; renderSummary(); collapse(); root.hidden = true; cancelAnimationFrame(clockFrame); resetRewards();
    outside().forEach(el => { el.inert = false; }); delete hud.dataset.battle;
    const ended = callbacks.change(undefined);
    if (again) void ended.then(again);
    (previousFocus?.isConnected && !previousFocus.hidden ? previousFocus : document.querySelector<HTMLElement>('#game'))?.focus({ preventScroll: true });
  }
  root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!target) return;
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
    // Mouse and keyboard belong to player 1: on player 2's turn only their controller counts (`control`).
    if (turnDriver() !== pointerPlayer) return;
    if (target.matches('.command-back, .target-back')) { back(); return; }
    if (target.matches('.anima-key')) { changeAnima(Number(target.dataset.step) as -1 | 1); return; }
    if (target.dataset.anima) { changeAnima(target.dataset.anima as ClassId); return; }
    if (target.dataset.skill) { beginTargeting(target.dataset.skill as SkillId); return; }
    if (target.dataset.dual) { chooseDual(target.dataset.dual as DualId); return; }
    if (target.dataset.element !== undefined) {
      if (state && chooseElement(state, state.allies[state.active], (target.dataset.element || undefined) as AttackElement | undefined)) { elementLearned = true; callbacks.sound('ui-move'); render(); }
      return;
    }
    if (target.matches('.command-trigger')) choose(target.closest<HTMLElement>('[data-command]')!.dataset.command as Command);
    else if (target.matches('[data-target], [data-confirm]')) void execute(target.dataset.target);
  });
  root.addEventListener('focusin', event => {
    if (event.target instanceof HTMLElement && event.target.parentElement?.classList.contains('skill-list')) keepInView(event.target);
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
      const rows = skillButtons(), at = rows.indexOf(document.activeElement as HTMLButtonElement);
      rows[Math.max(0, Math.min(rows.length - 1, (at < 0 ? Number(list.dataset.start ?? 0) : at) + Math.sign(event.deltaY)))]?.focus({ preventScroll: true });
    }, { passive: false });
  }
  // The queue never takes the page's focus (it belongs to whoever's turn it is), not even on a click.
  root.addEventListener('mousedown', event => { if ((event.target as HTMLElement).closest('.queue-panel, .queue-plate')) event.preventDefault(); });
  for (const eventName of ['pointerover', 'focusin']) root.addEventListener(eventName, event => {
    if (!targeting || busy) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-target]');
    if (button && !button.disabled) highlight(button.dataset.target);
  });
  /** Who the click being handled comes from: the mouse and keyboard, unless `control` is pressing for a controller. */
  let pointerPlayer: PlayerId = 1;
  function keydown(event: KeyboardEvent) {
    if (!state || event.metaKey || event.ctrlKey || event.altKey) return;
    // The summary is anyone's to open and close, at any moment (R, or Esc while it is open).
    if ((event.code === 'KeyR' && !event.repeat) || (event.key === 'Escape' && summaryOpen)) { event.preventDefault(); event.stopPropagation(); toggleSummary(event.code === 'KeyR' ? undefined : false); return; }
    const over = ['won', 'lost', 'escaped'].includes(state.phase);
    // On the other player's turn (or while a move plays) the keyboard only reaches player 1's move ready ahead.
    if (!over && (turnDriver() !== 1 || busy)) {
      const key = event.key === 'Enter' || event.key === ' ' ? 'confirm' : event.key === 'Escape' ? 'cancel' : event.key.startsWith('Arrow') ? event.key.slice(5).toLowerCase() as Direction : undefined;
      if (key && !event.repeat && queueControl(key, 1)) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.key.toLowerCase() === 'x' && !event.repeat && queueElement(1)) { event.preventDefault(); event.stopPropagation(); return; }
    }
    if (turnDriver() !== 1 && !over) { event.preventDefault(); event.stopPropagation(); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat && document.activeElement instanceof HTMLButtonElement) document.activeElement.click();
    } else if (event.key === 'Tab') {
      const buttons = [...root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(b => b.tabIndex >= 0 && !b.closest('[inert], [hidden]'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'Escape') { event.preventDefault(); back(); }
    else if (/^[1-9]$/.test(event.key) && !event.repeat) {
      event.preventDefault();
      const index = Number(event.key) - 1;
      if (targeting) targetButtons()[index]?.focus();
      else if (selected === 'skill' || selected === 'dual') skillButtons()[index]?.click();
      else if (COMMANDS[index]) choose(COMMANDS[index].id);
    }
    else if (event.key.toLowerCase() === 'i' && !event.repeat) { event.preventDefault(); showDetails(!details); }
    else if (event.key.toLowerCase() === 'x' && !event.repeat) { event.preventDefault(); if (!busy && state.phase === 'player' && (!selected || (selected === 'attack' && targeting))) nextElement(state.allies[state.active]); }
    else if (['q', 'e'].includes(event.key.toLowerCase()) && !event.repeat) { event.preventDefault(); changeAnima(event.key.toLowerCase() === 'q' ? -1 : 1); }
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
      const index = visible.indexOf(document.activeElement as HTMLButtonElement);
      visible[index < 0 ? 0 : (index + step + visible.length) % visible.length]?.focus({ preventScroll: true });
    };
    if (targeting) walk(targetButtons());
    else if (selected === 'skill' || selected === 'dual') {
      if (direction === 'left') back();
      else if (direction !== 'right') walk([...root.querySelectorAll<HTMLButtonElement>('.skill-flyout button')]);
    } else if (direction === 'right') {
      const sheet = (['skill', 'dual'] as const).find(id => root.querySelector(`[data-command="${id}"] .command-trigger`) === document.activeElement);
      if (sheet) choose(sheet);
    }
    else if (direction === 'left') return;
    else walk([...root.querySelectorAll<HTMLButtonElement>('.command-trigger, .battle-result button')]);
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
      if (moment === 'won-level') state.extraXp = Math.max(0, Math.max(0, ...participants(state).map(p => toNextLevel(xpBefore[p.id] ?? 0, state!.levels?.[p.id] ?? 1))) - fightXp({ foes: state.foes }));
      state.phase = moment === 'lost' ? 'lost' : 'won';
      state.message = moment === 'lost' ? 'Depuración: combate perdido.' : moment === 'won-level' ? 'Depuración: combate ganado, con experiencia para subir de nivel.' : 'Depuración: combate ganado.';
    } else if (moment === 'foes-low' || moment === 'party-low') {
      for (const unit of moment === 'foes-low' ? state.foes : state.allies) if (unit.hp > 0) unit.hp = 1;
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
  const ui = {
    /** Development: what the picker needs to offer this fight's moments. */
    get fight() { return state && { encounter: state.encounter, phase: state.phase, awakened: state.awakened, busy }; },
    jumpTo,
    /** Development (the picker's Ánimas column): the ánimas L and R walk through and their levels, changed mid-fight. */
    setAnimas(animas: ClassId[], levels: Partial<Record<ClassId, number>>, kits: Partial<Record<string, ClassId[]>> = {}) {
      if (!state) return;
      state.animas = [...animas]; state.levels = { ...levels };
      for (const ally of state.allies) if (kits[ally.id]) ally.kit = [...kits[ally.id]!];
      render();
    },
    /** Development (the picker's Ayudas): changes the fight as a help asks, and redraws it at once. */
    tweak(change: (state: BattleState) => void) { if (!state) return; change(state); render(); },
    /** Development: leaves the fight at once, with no result (the picker, before going elsewhere). */
    end() { if (state) close(); },
    /**
     * Where the fight's input is; its third part names an open sub-menu (a command, the summary, or
     * the keyboard player's move ready ahead), so Escape backs out of it (or takes it back) before pausing.
     */
    get controllerContext() { return !state ? 'world' : `battle:${busy ? 'busy' : state.phase}:${selected ?? (summaryOpen ? 'summary' : queueContext())}:${selectedSkill ?? ''}:${targeting}`; },
    /** △ / Y (X on a Switch pad): the details window beside the focused skill; on the commands, or aiming Atacar, its next element. */
    details(player: PlayerId = 1) {
      if (!state) return;
      if (busy || player !== turnDriver()) { queueElement(player); return; }
      if (state.phase === 'player' && (!selected || (selected === 'attack' && targeting))) nextElement(state.allies[state.active]);
      else showDetails(!details);
    },
    /** A controller press; `player` is whose controller it is. Only the turn's own player is heard. */
    control(action: ControlAction | 'prev' | 'next', player: PlayerId = 1) {
      if (!state) return;
      if (action === 'cancel' && summaryOpen) { toggleSummary(false); return; }
      const ended = ['won', 'lost', 'escaped'].includes(state.phase);
      // The other player's presses (or anyone's while a move plays) go to their move ready ahead, if any.
      if (!ended && (player !== turnDriver() || busy) && queueControl(action, player)) return;
      if (busy) return;
      if (!ended && player !== turnDriver()) return;
      // L / R: the active fighter's previous or next ánima.
      if (action === 'prev' || action === 'next') { if (!ended) changeAnima(action === 'prev' ? -1 : 1); }
      // Backing out of a fall that can be undone steps back to before the fight.
      else if (action === 'cancel') { if (ended) { if (!holdingRewards()) close(state.phase === 'lost' && callbacks.forgiving?.() ? 'rewind' : undefined); } else back(); }
      else if (action === 'confirm') { pointerPlayer = player; try { clickControllerButton(root); } finally { pointerPlayer = 1; } }
      else if (action !== 'menu') navigate(action);
    },
    /** The D-pad's left or right (src/controller.ts `readController`): for either player at any moment. */
    toggleSummary() { toggleSummary(); },
    /** Whether the summary is open (scenarios and tests). */
    get summary() { return summaryOpen; },
    positionTargets(targets: { id: string; x: number; y: number; visible: boolean }[]) {
      for (const target of targets) {
        positions.set(target.id, target);
        const button = root.querySelector<HTMLElement>(`.battle-target[data-target="${target.id}"]`);
        if (!button) continue;
        button.hidden = !target.visible;
        button.style.transform = `translate(${target.x}px, ${target.y}px) translate(-50%, -100%)`;
      }
    },
    /** `party` is who fights on Gerard's side (story.battleParty), or a size for chapter 1's boys. */
    /** `animas` are the party's unlocked ánimas (story.classes); L and R walk through them. `guards` sizes the palace guards. */
    open(party: PartySlot[] | 1 | 2, foeCount = 1, options: { possessed?: boolean; encounter?: Encounter; animas?: ClassId[]; guards?: GuardStrength; levels?: Partial<Record<ClassId, number>>; xp?: Partial<Record<ClassId, number>>; improved?: Improved } = {}) {
      if (state) return;
      const count = foeCount;
      reopen = (): void => { ui.open(party, count, options); };
      previousFocus = document.activeElement as HTMLElement;
      const token = ++generation;
      const { possessed = false, encounter = 'dogs' } = options;
      const slots = typeof party === 'number' ? childParty(party, options.animas?.at(-1)) : party;
      state = (FEAR_ENCOUNTERS as readonly string[]).includes(encounter) ? createFearBattle(slots, encounter as (typeof FEAR_ENCOUNTERS)[number], options.animas)
        : encounter === 'palace-minion' ? createMinionBattle(slots[0]?.classId, options.animas)
        : encounter === 'palace-guards' ? createGuardBattle(slots, options.guards ?? palaceGuards(0), options.animas)
        : createBattle(slots, foeCount, possessed, undefined, options.animas); busy = true;
      state.levels = options.levels;
      if (options.improved) improve(state, options.improved);
      xpBefore = { ...options.xp }; rewarded = false; resetRewards();
      foeCount = state.foes.length;
      root.toggleAttribute('data-possessed', possessed);
      root.dataset.encounter = encounter;
      get('[data-command="skill"]').classList.remove('is-new');
      get('.class-banner').hidden = true; get('.dual-banner').hidden = true; get('.dual-cinema').hidden = true; get('.battle-speech').replaceChildren();
      queueMenu = undefined; firing = undefined; stale = undefined; slowUntil = 0; charges = 0;
      get('.battle-heading h1').innerHTML = FEAR_TITLES[encounter as keyof typeof FEAR_TITLES] ?? (encounter === 'palace-minion' ? 'Un esbirro <em>de verdad.</em>' : encounter === 'palace-guards' ? 'Los guardianes <em>de la cortina.</em>' : possessed ? 'Ojos <em>rosados.</em>' : 'Un pequeño <em>contratiempo.</em>');
      get('.battle-targets').innerHTML = [...state.foes, ...state.allies].map((f, i) => plateHtml(f, i, i < foeCount)).join('');
      root.dataset.entering = 'true'; delete root.dataset.resolving;
      root.querySelectorAll('.party-card').forEach(card => card.remove()); root.querySelectorAll('.anima-chips').forEach(chips => chips.removeAttribute('data-for'));
      get('.battle-dock[data-dock="1"]').append(get('.command-panel'));
      get('.battle-pops').replaceChildren(); positions.clear();
      hud.dataset.battle = 'open'; outside().forEach(el => { el.inert = true; });
      root.hidden = false; render(); root.focus({ preventScroll: true }); startClock();
      get('.turn-meta').textContent = 'ENCUENTRO';
      void callbacks.change(state).then(() => {
        if (token !== generation || !state) return;
        delete root.dataset.entering; busy = false; render(); focusFirst();
      });
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
