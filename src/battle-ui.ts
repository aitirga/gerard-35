import { clickControllerButton } from './controller-ui';
import type { ControlAction } from './controller';
import { act, aimed, ANIMA_NAMES, awaken, boostRounds, childParty, cornered, createBattle, createMinionBattle, enemyAct, nextRound, skillsFor, SKILLS, switchAnima, validTargets, wearAnima, wearsAnimas, type ClassId, type Encounter, type PartySlot, type SkillId, type BattleAction, type BattleEffect, type BattleState, type Combatant } from './battle';
import { CLASSES } from './classes';
import { BATTLE_LINES } from './chapter-1';
import { SPEAKERS } from './dialogue';
import { DOG_PROFILES } from './encounters';
import { planEnemyTurn } from './battle-ai';
import type { Direction } from './movement';
import type { PlayerId } from './party';

/** `mystery` is a command nobody can use yet: the menu keeps its place. */
type Command = BattleAction | 'mystery';
const COMMANDS: { id: Command; name: string }[] = [
  { id: 'attack', name: 'Atacar' },
  { id: 'skill', name: 'Habilidad' },
  { id: 'mystery', name: '?????' },
  { id: 'defend', name: 'Defender' },
  { id: 'escape', name: 'Huir' },
];
const TARGETS = { foes: 'Un enemigo', allies: 'Un aliado herido', party: 'Todo el equipo' } as const;
/** The details hint goes once it has been used (AGENTS.md: key hints disappear once used). */
let detailsLearned = false;
export function createBattleUI(hud: HTMLElement, callbacks: {
  change: (state: BattleState | undefined, effect?: BattleEffect, onImpact?: () => void) => Promise<void>;
  target: (id?: string) => void;
  /** An ánima woke up in Gerard mid-fight (the palace minion's beat). */
  awaken: (id: 'noista') => void;
  /** Someone swapped ánima with L / R; it stays on after the fight. */
  changeAnima: (allyId: string, id: ClassId) => void;
  /** Which player picks this fighter's moves (docs/party.md). Keyboard and mouse are player 1. */
  driver: (allyId: string) => PlayerId;
  /** Whether that player has nothing to play with yet (player 2 without a controller). */
  waiting: (allyId: string) => boolean;
}) {
  const root = document.createElement('section');
  root.id = 'battle'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Combate por turnos');
  root.innerHTML = `
    <header class="battle-heading"><span class="battle-kicker">ENCUENTRO / PASSATGE MARESME</span><h1>Un pequeño <em>contratiempo.</em></h1></header>
    <div class="round-badge"><span>RONDA</span><strong>01</strong></div>
    <div class="battle-targets" aria-label="Objetivos en la calle"></div>
    <div class="battle-pops" aria-hidden="true"></div>
    <div class="battle-speech" aria-live="assertive"></div>
    <section class="class-banner" hidden><span class="battle-kicker">ÁNIMA DESBLOQUEADA</span><h2></h2><p></p></section>
    <div class="battle-bottom">
      <section class="command-panel" aria-label="Acciones de combate">
        <div class="anima-bar" role="group" aria-label="Ánimas"><button class="anima-key" type="button" tabindex="-1" data-step="-1" aria-label="Ánima anterior"><span data-glyph="animaPrev"></span></button><div class="anima-track"><span class="anima-indicator" aria-hidden="true"></span></div><button class="anima-key" type="button" tabindex="-1" data-step="1" aria-label="Ánima siguiente"><span data-glyph="animaNext"></span></button></div>
        <div class="turn-heading"><span class="turn-dot"></span><span class="turn-label"></span><span class="turn-meta">TU TURNO</span></div>
        <div class="command-deck">
          <div class="commands">${COMMANDS.map((c, i) => `<article class="command" data-command="${c.id}">
            <button class="command-trigger" type="button" ${c.id === 'skill' ? 'aria-expanded="false" aria-controls="skill-flyout"' : ''} ${c.id === 'mystery' ? 'aria-label="Opción aún desconocida" disabled' : ''}><span class="command-number">0${i + 1}</span><strong>${c.name}</strong>${c.id === 'skill' ? '<span class="command-arrow" aria-hidden="true">›</span>' : ''}</button>
          </article>`).join('')}</div>
          <section class="skill-flyout" id="skill-flyout" aria-label="Habilidades" inert><div class="skill-sheet">
            <span class="battle-kicker"></span>
            <div class="skill-list"></div>
            <footer><button class="command-back" type="button">Volver <span data-glyph="cancel"></span></button><p class="flyout-hint"><kbd data-glyph="details"></kbd> Detalles</p></footer>
          </div></section>
        </div>
        <div class="target-picker" hidden><span class="battle-kicker">ELIGE UN OBJETIVO</span><h2></h2><p></p><button class="target-back" type="button">Volver <span data-glyph="cancel"></span></button></div>
        <p class="command-help"></p>
      </section>
      <div class="party-roster" aria-label="Tu equipo"></div>
    </div>
    <aside class="skill-info" role="tooltip" id="skill-info" hidden><h3></h3><p></p><strong class="skill-info-cost"></strong></aside>
    <section class="battle-result" hidden><span class="battle-kicker">FIN DEL ENCUENTRO</span><h2></h2><p></p><button type="button">Volver a la calle</button></section>`;
  hud.append(root);
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  let state: BattleState | undefined;
  let selected: BattleAction | undefined;
  let selectedSkill: SkillId | undefined;
  let targeting = false;
  /** The details window beside the focused skill (△ / Y on a controller, I on the keyboard). */
  let details = false;
  let busy = false;
  let generation = 0;
  let previousFocus: HTMLElement | null = null;
  const outside = () => [...hud.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== root);
  const articles = [...root.querySelectorAll<HTMLElement>('.command')];
  function focusFirst() { get<HTMLButtonElement>('.command-trigger').focus({ preventScroll: true }); }
  const panel = get('.command-panel');
  const skillButtons = () => [...root.querySelectorAll<HTMLButtonElement>('[data-skill]')];
  /** Why a command can't be used now, if it can't. Bernat has no skills: he only attacks. */
  function blocked(command: Command) {
    if (!state || busy || state.phase !== 'player' || callbacks.waiting(state.allies[state.active].id)) return true;
    if (command === 'mystery') return true;
    if (command === 'escape') return cornered(state);
    if (command === 'skill') return !skillsFor(state, state.allies[state.active]).length;
    return false;
  }
  function meter(c: Combatant, secondary = false) {
    const value = secondary ? c.secondary : c.hp, max = secondary ? c.maxSecondary : c.maxHp;
    const label = secondary ? 'Secundaria' : 'PV';
    return `<div class="meter-caption"><span>${label}</span><strong>${value}<small> / ${max}</small></strong></div><div class="battle-meter ${secondary ? 'secondary' : ''}" role="progressbar" aria-label="${c.name}: ${label}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${max}"><b style="width:${value / max * 100}%"></b><i style="width:${value / max * 100}%"></i></div>`;
  }
  // The dark trail lags behind the fill, so each hit shows how much it took.
  function fill(bar: Element, ratio: number) { bar.querySelectorAll<HTMLElement>('b, i').forEach(el => { el.style.width = `${ratio * 100}%`; }); }
  const positions = new Map<string, { x: number; y: number }>();
  function pop(id: string, text: string, kind: 'damage' | 'heal' | 'guard', detail = '') {
    const at = positions.get(id);
    if (!at) return;
    const el = document.createElement('span');
    el.className = 'damage-pop'; el.dataset.kind = kind;
    el.innerHTML = `<strong></strong>${detail ? '<small></small>' : ''}`;
    el.querySelector('strong')!.textContent = text;
    if (detail) el.querySelector('small')!.textContent = detail;
    el.style.transform = `translate(${at.x + (Math.random() - .5) * 26}px, ${at.y - 18}px) translate(-50%, -100%)`;
    get('.battle-pops').append(el);
    setTimeout(() => el.remove(), 1100);
  }
  const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
  /** A line said over a fighter's head, inside the fight (the rest of the HUD is shut). */
  async function speak(line: { speaker: keyof typeof SPEAKERS; text: string }, ms: number, shout = false) {
    const at = positions.get(line.speaker);
    const el = document.createElement('p');
    el.className = 'battle-speech-line'; if (shout) el.dataset.shout = 'true';
    el.innerHTML = '<span></span>';
    el.querySelector('span')!.textContent = line.text;
    el.style.setProperty('--accent', SPEAKERS[line.speaker].accent);
    if (at) el.style.transform = `translate(${at.x}px, ${at.y - 40}px) translate(-50%, -100%)`;
    get('.battle-speech').append(el);
    await wait(ms);
    el.dataset.leaving = 'true';
    setTimeout(() => el.remove(), 300);
  }
  /**
   * The palace minion is about to finish Bernat: he cries out, Gerard shouts NO, his class wakes
   * up (the fight shows it, the story records it) and the interface takes on its colours.
   */
  async function playBeat(token: number) {
    if (!state) return;
    root.dataset.beat = 'true';
    render();
    await wait(500);
    await speak(BATTLE_LINES.aboutToDie, 1900);
    if (token !== generation || !state) return;
    root.dataset.shaking = 'true';
    const shout = speak(BATTLE_LINES.no, 1700, true);
    await wait(350);
    callbacks.awaken('noista');
    awaken(state, 'noista');
    await shout;
    delete root.dataset.shaking;
    if (token !== generation || !state) return;
    const banner = get('.class-banner');
    banner.querySelector('h2')!.textContent = CLASSES.noista.name;
    banner.querySelector('p')!.textContent = CLASSES.noista.motto;
    banner.hidden = false;
    await wait(2600);
    banner.hidden = true;
    delete root.dataset.beat;
    // The one new thing on screen: Habilidades pulses until it is opened.
    get('[data-command="skill"]').classList.add('is-new');
  }
  /** Gerard as a boy has a painted portrait; the rest use their provisional dialogue art. */
  function portrait(c: Combatant) {
    if (c.profile === 'gerard') return `<img src="${import.meta.env.BASE_URL}portraits/gerard-child.png" alt=""/>`;
    if (c.profile === 'gerard35') return SPEAKERS.gerard35.art;
    if (c.profile === 'aitor') return SPEAKERS.aitor.art;
    return `<span>${c.name[0]}</span>`;
  }
  /** Opens or closes the details window; it follows focus through the skills while open. */
  function showDetails(open: boolean) {
    details = open && selected === 'skill' && !targeting;
    if (details && !detailsLearned) { detailsLearned = true; get('.flyout-hint').dataset.learned = 'true'; }
    placeDetails();
  }
  function placeDetails() {
    const box = get('.skill-info');
    const button = document.activeElement instanceof HTMLButtonElement && document.activeElement.dataset.skill ? document.activeElement : undefined;
    const skill = button && SKILLS.find(s => s.id === button.dataset.skill);
    box.hidden = !details || !skill || !state;
    if (box.hidden || !skill || !state) { button?.removeAttribute('aria-describedby'); return; }
    button!.setAttribute('aria-describedby', 'skill-info');
    box.querySelector('h3')!.textContent = skill.name;
    box.querySelector('p')!.textContent = skill.description;
    box.querySelector('.skill-info-cost')!.textContent = `${skill.cost} SEC`;
    // Beside the skill, out past the flyout, vertically centred on it.
    const base = root.getBoundingClientRect(), at = button!.getBoundingClientRect(), sheet = get('.skill-flyout').getBoundingClientRect();
    box.style.left = `${Math.max(at.right, sheet.right) - base.left + 18}px`;
    box.style.top = `${at.top + at.height / 2 - base.top}px`;
  }
  /** Whose hands the current turn is in; nobody else's input counts. */
  const turnDriver = (): PlayerId => state && state.phase === 'player' ? callbacks.driver(state.allies[state.active].id) : 1;
  const targetButtons = () => [...root.querySelectorAll<HTMLButtonElement>('.roster-target:not(:disabled), .battle-target[data-side="foes"]:not(:disabled)')].filter(button => !button.hidden);
  function render() {
    if (!state) return;
    const ended = !busy && ['won', 'lost', 'escaped'].includes(state.phase);
    root.dataset.phase = state.phase;
    get('.battle-heading .battle-kicker').textContent = state.encounter === 'palace-minion' ? 'ENCUENTRO / ESBIRRO DE LA REINA'
      : `ENCUENTRO / ${state.foes.filter(f => f.hp > 0).length} DE ${state.foes.length} PERROS${state.possessed ? ' POSEÍDOS' : ''}`;
    get('.round-badge strong').textContent = String(state.round).padStart(2, '0');
    const actor = state.allies[state.active];
    get('.turn-label').textContent = actor.name;
    renderAnimas(actor);
    const waiting = !busy && state.phase === 'player' && callbacks.waiting(actor.id);
    get('.turn-meta').textContent = busy || state.phase === 'enemy' ? 'EN ACCIÓN' : waiting ? 'CONECTA EL MANDO 2' : callbacks.driver(actor.id) === 2 ? 'MANDO 2' : 'TU TURNO';
    root.dataset.player = String(turnDriver());
    root.toggleAttribute('data-waiting', waiting);
    // Preserve meter nodes so health changes interpolate instead of snapping.
    const roster = get('.party-roster');
    if (!roster.children.length) roster.innerHTML = state.allies.map(c => `<article class="party-card" data-unit="${c.id}">
      <div class="party-portrait">${portrait(c)}</div>
      <div class="unit-info"><div class="unit-heading"><strong>${c.name}</strong><span class="unit-boost" hidden></span><span class="unit-status"></span></div>${meter(c)}${meter(c, true)}</div><button class="roster-target" type="button" data-target="${c.id}" aria-label="Elegir a ${c.name}" hidden></button></article>`).join('');
    for (const c of state.allies) {
      const card = roster.querySelector<HTMLElement>(`[data-unit="${c.id}"]`)!;
      card.classList.toggle('is-active', state.phase === 'player' && state.allies[state.active].id === c.id);
      card.classList.toggle('is-down', c.hp === 0);
      card.classList.toggle('is-acting', root.dataset.actor === c.id);
      const boost = card.querySelector<HTMLElement>('.unit-boost')!;
      boost.hidden = !boostRounds(state) || c.hp === 0;
      boost.textContent = `▲ ${boostRounds(state)}`;
      boost.title = `Análisis Parálisis: Fuerza y Magia +${state.boost?.amount ?? 0}`;
      card.querySelector('.unit-status')!.textContent = c.hp === 0 ? 'FUERA' : c.guarding ? 'EN GUARDIA' : state.allies[state.active].id === c.id && state.phase === 'player' ? 'ACTIVO' : '';
      card.querySelectorAll<HTMLElement>('.battle-meter').forEach((bar, i) => {
        const value = i === 0 ? c.hp : c.secondary, max = i === 0 ? c.maxHp : c.maxSecondary;
        bar.setAttribute('aria-valuenow', String(value));
        fill(bar, value / max);
        bar.previousElementSibling!.querySelector('strong')!.innerHTML = `${value}<small> / ${max}</small>`;
      });
      const plate = root.querySelector(`.battle-target[data-target="${c.id}"]`);
      if (plate) plate.querySelectorAll('.enemy-health').forEach((bar, i) => fill(bar, i === 0 ? c.hp / c.maxHp : c.secondary / c.maxSecondary));
    }
    for (const foe of state.foes) {
      const plate = get<HTMLButtonElement>(`.battle-target[data-target="${foe.id}"]`);
      fill(plate.querySelector('.enemy-health')!, foe.hp / foe.maxHp);
      const health = foe.hp === 0 ? 'fuera de combate' : foe.hp === foe.maxHp ? 'salud completa' : foe.hp / foe.maxHp <= .3 ? 'salud baja' : 'herido';
      plate.setAttribute('aria-label', `Elegir a ${foe.name}, ${health}`);
      plate.classList.toggle('is-down', foe.hp === 0);
      plate.classList.toggle('is-acting', root.dataset.actor === foe.id);
    }
    // Possessed dogs surround the party: Huir stays greyed out. A turn waiting for player 2 locks every command.
    articles.forEach(article => { article.querySelector<HTMLButtonElement>('.command-trigger')!.disabled = blocked(article.dataset.command as Command); });
    const eligible = targeting && !busy && state.phase === 'player' ? validTargets(state, selected!, selectedSkill).map(c => c.id) : [];
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
      : selected === 'skill' ? '{updown} elegir · {confirm} usar · {details} detalles · {cancel} volver'
      : '{pick} elegir · {confirm} confirmar · {animaPrev} {animaNext} ánima · {cancel} volver';
    get('.flyout-hint').toggleAttribute('hidden', detailsLearned);
    get('.battle-bottom').hidden = ended;
    get('.battle-result').hidden = !ended;
    if (ended) {
      get('.battle-result h2').textContent = state.phase === 'won' ? '¡Camino libre!' : state.phase === 'escaped' ? 'Seguimos.' : 'Un respiro.';
      get('.battle-result p').textContent = state.message;
      get<HTMLButtonElement>('.battle-result button').focus({ preventScroll: true });
    }
  }
  function collapse(restoreFocus = false) {
    const old = selected; selected = undefined; selectedSkill = undefined; targeting = false;
    highlight(); delete root.dataset.targeting;
    root.querySelectorAll<HTMLButtonElement>('[data-target]').forEach(button => {
      button.disabled = true;
      button.closest('[data-unit]')?.classList.remove('is-eligible');
    });
    get('.command-deck').hidden = false; get('.target-picker').hidden = true;
    root.querySelectorAll<HTMLElement>('.roster-target').forEach(button => { button.hidden = true; button.closest('[data-unit]')?.classList.remove('is-eligible'); });
    articles.forEach(article => article.classList.remove('expanded'));
    get('[data-command="skill"] .command-trigger').setAttribute('aria-expanded', 'false');
    delete panel.dataset.flyout; get('.skill-flyout').inert = true;
    showDetails(false);
    if (restoreFocus && old) get<HTMLButtonElement>(`[data-command="${old}"] .command-trigger`).focus();
  }
  function highlight(id?: string) {
    callbacks.target(id);
    root.querySelectorAll<HTMLElement>('[data-unit], [data-target]').forEach(el => {
      el.classList.toggle('is-targeted', !!id && (el.dataset.unit === id || el.dataset.target === id));
    });
  }
  /** Atacar asks for a target, Habilidad opens its flyout to the right, Defender and Huir happen at once. */
  function choose(command: Command) {
    if (!state || blocked(command) || command === 'mystery') return;
    if (command === 'skill') get('[data-command="skill"]').classList.remove('is-new');
    if (selected === command) { collapse(true); render(); return; }
    collapse(); selected = command;
    get(`[data-command="${command}"]`).classList.add('expanded');
    if (command === 'attack') { beginTargeting(); return; }
    if (command !== 'skill') { void execute(); return; }
    get('[data-command="skill"] .command-trigger').setAttribute('aria-expanded', 'true');
    panel.dataset.flyout = 'open'; get('.skill-flyout').inert = false;
    // The sheet starts level with Habilidad, as if it slid out of it.
    panel.style.setProperty('--flyout-top', `${get('[data-command="skill"]').offsetTop}px`);
    fillSkills();
    render();
    (skillButtons().find(b => !b.hasAttribute('aria-disabled')) ?? skillButtons()[0] ?? get<HTMLButtonElement>('.skill-flyout .command-back')).focus({ preventScroll: true });
  }
  /** The flyout's sheet: the active fighter's skills right now (an ánima swap refills it). */
  function fillSkills() {
    if (!state) return;
    const actor = state.allies[state.active];
    get('.skill-flyout .battle-kicker').textContent = `HABILIDADES · ${actor.name.toUpperCase()}${actor.classId ? ` · ${ANIMA_NAMES[actor.classId].toUpperCase()}` : ''}`;
    // Unaffordable skills stay focusable so their details can still be read.
    get('.skill-list').innerHTML = skillsFor(state, actor).map((skill, i) => {
      const affordable = actor.secondary >= skill.cost;
      const available = validTargets(state!, 'skill', skill.id).length > 0;
      const reason = !affordable ? 'Sin energía' : available ? `${skill.cost} SEC` : skill.kind === 'boost' ? 'En marcha' : skill.side === 'foes' ? 'Sin objetivo' : 'Equipo al máximo';
      return `<button type="button" data-skill="${skill.id}" data-class="${skill.class}" ${!affordable || !available ? 'aria-disabled="true"' : ''} style="--i:${i}"><span class="skill-key">${i + 1}</span><span class="skill-name"><strong>${skill.name}</strong><small>${TARGETS[skill.side]}</small></span><small class="skill-cost">${reason}</small></button>`;
    }).join('') || '<p class="skill-empty">Sin habilidades con esta ánima.</p>';
  }
  /**
   * L / R (Q / E on the keyboard), or a click on an ánima: the active fighter swaps ánima. The
   * menu sweeps, the skills slide back in, and the fighter flashes in the street.
   */
  function changeAnima(choice: -1 | 1 | ClassId) {
    if (!state || busy || targeting || state.phase !== 'player' || callbacks.waiting(state.allies[state.active].id)) return;
    const actor = state.allies[state.active];
    const next = typeof choice === 'number' ? switchAnima(state, choice) : wearAnima(state, choice) ? choice : undefined;
    const bar = get('.anima-bar');
    bar.classList.remove('is-stuck', 'is-swapping'); void bar.offsetWidth;
    if (!next) { bar.classList.add('is-stuck'); return; }
    callbacks.changeAnima(actor.id, next);
    panel.classList.remove('is-swapping'); void panel.offsetWidth; panel.classList.add('is-swapping');
    bar.classList.add('is-swapping');
    pop(actor.id, ANIMA_NAMES[next], 'guard', 'Ánima');
    showDetails(false);
    if (selected === 'skill') {
      fillSkills();
      (skillButtons().find(b => !b.hasAttribute('aria-disabled')) ?? skillButtons()[0] ?? get<HTMLButtonElement>('.skill-flyout .command-back')).focus({ preventScroll: true });
    }
    render();
  }
  /** The ánima strip above the menu: who can wear what, and what the active fighter wears. */
  function renderAnimas(actor: Combatant) {
    if (!state) return;
    const bar = get('.anima-bar'), track = get('.anima-track');
    const key = state.animas.join(',');
    if (track.dataset.key !== key) {
      track.dataset.key = key;
      track.querySelectorAll('.anima-chip').forEach(chip => chip.remove());
      track.insertAdjacentHTML('beforeend', state.animas.map(id => `<button class="anima-chip" type="button" tabindex="-1" data-anima="${id}" aria-pressed="false">${ANIMA_NAMES[id]}</button>`).join(''));
    }
    const off = !wearsAnimas(actor) || !state.animas.length;
    bar.toggleAttribute('data-off', off);
    bar.title = off ? `${actor.name} no lleva ánima` : 'Cambiar de ánima';
    let worn: HTMLElement | undefined;
    track.querySelectorAll<HTMLButtonElement>('.anima-chip').forEach(chip => {
      const on = !off && chip.dataset.anima === actor.classId;
      chip.setAttribute('aria-pressed', String(on));
      if (on) worn = chip;
    });
    const indicator = get('.anima-indicator');
    indicator.hidden = !worn;
    if (worn) { indicator.style.left = `${worn.offsetLeft}px`; indicator.style.width = `${worn.offsetWidth}px`; }
  }
  function beginTargeting(skill?: SkillId) {
    if (!state || busy || !selected) return;
    if (skill && (state.allies[state.active].secondary < SKILLS.find(s => s.id === skill)!.cost || !validTargets(state, 'skill', skill).length)) return;
    showDetails(false);
    // A skill that reaches the whole party has nobody to pick: it happens at once.
    if (skill && !aimed(skill)) { selectedSkill = skill; void execute(); return; }
    selectedSkill = skill; targeting = true;
    const onAllies = !!skill && SKILLS.find(s => s.id === skill)!.side === 'allies';
    root.dataset.targeting = onAllies ? 'allies' : 'foes';
    get('.target-picker h2').textContent = skill ? SKILLS.find(s => s.id === skill)!.name : 'Atacar';
    get('.target-picker p').textContent = onAllies ? 'Elige un aliado herido de tu equipo.' : state.encounter === 'palace-minion' ? 'Elige al esbirro.' : 'Elige un perro en la calle.';
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
    } else { collapse(true); render(); }
  }
  async function present(effect: BattleEffect, token: number) {
    if (!state) return;
    root.dataset.resolving = 'true';
    root.dataset.actor = effect.actor;
    root.querySelectorAll<HTMLElement>('[data-unit]').forEach(card => card.classList.toggle('is-acting', card.dataset.unit === effect.actor));
    articles.forEach(article => { article.querySelector<HTMLButtonElement>('.command-trigger')!.disabled = true; });
    get('.turn-meta').textContent = 'EN ACCIÓN';
    await callbacks.change(state, effect, () => {
      if (token !== generation || !state) return;
      render();
      const card = root.querySelector<HTMLElement>(`[data-unit="${effect.target ?? effect.actor}"]`);
      card?.classList.remove('contact-hit');
      // Restart the local accent on each contact, including repeated targets.
      if (card) { void card.offsetWidth; card.classList.add('contact-hit'); }
      const target = [...state.allies, ...state.foes].find(c => c.id === (effect.target ?? effect.actor));
      if (effect.kind === 'defend') pop(effect.actor, 'En guardia', 'guard');
      else if (effect.boosted) effect.boosted.forEach(id => pop(id, 'Análisis', 'guard', `Fuerza y Magia +${state!.boost?.amount ?? 0}`));
      else if (effect.skill && SKILLS.find(s => s.id === effect.skill)!.kind === 'heal' && effect.target) pop(effect.target, `+${effect.amount ?? 0}`, 'heal', 'PV');
      else if (effect.swallowed && effect.target) pop(effect.target, '0', 'guard', '¡Se lo traga!');
      else if (effect.target && target) pop(effect.target, `−${effect.amount ?? 0}`, 'damage', target.hp === 0 ? '¡Fuera!' : target.guarding ? 'Protegido' : effect.skill ? SKILLS.find(s => s.id === effect.skill)!.name : '');
    });
    if (token === generation) { delete root.dataset.resolving; delete root.dataset.actor; }
  }
  async function execute(target?: string) {
    if (!state || !selected || busy) return;
    if ((selected === 'attack' || (selected === 'skill' && (!selectedSkill || aimed(selectedSkill)))) && !targeting) return;
    const effect = act(state, selected, target, selectedSkill);
    if (!effect) return;
    const token = generation;
    busy = true; collapse(); root.focus({ preventScroll: true });
    await present(effect, token);
    if (token !== generation || !state) return;
    if (state.phase === 'enemy') {
      const plan = await planEnemyTurn(state);
      if (token !== generation || !state) return;
      for (const foe of state.foes.filter(f => f.hp > 0)) {
        const response = enemyAct(state, foe.id, plan[foe.id]);
        if (response) await present(response, token);
        if (token !== generation || !state) return;
      }
      // enemyAct may have stopped the fight for the palace beat (TypeScript still thinks it is 'enemy').
      if ((state.phase as BattleState['phase']) === 'beat') await playBeat(token);
      if (token !== generation || !state) return;
      nextRound(state); void callbacks.change(state);
    }
    busy = false; render();
    if (state.phase === 'player') focusFirst();
  }
  function close() {
    generation++; state = undefined; busy = false; collapse(); root.hidden = true;
    outside().forEach(el => { el.inert = false; }); delete hud.dataset.battle;
    void callbacks.change(undefined);
    (previousFocus?.isConnected && !previousFocus.hidden ? previousFocus : document.querySelector<HTMLElement>('#game'))?.focus({ preventScroll: true });
  }
  root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!target) return;
    if (target.closest('.battle-result')) { close(); return; }
    // Mouse and keyboard belong to player 1: on player 2's turn only their controller counts (`control`).
    if (turnDriver() !== pointerPlayer) return;
    if (target.matches('.command-back, .target-back')) { back(); return; }
    if (target.matches('.anima-key')) { changeAnima(Number(target.dataset.step) as -1 | 1); return; }
    if (target.dataset.anima) { changeAnima(target.dataset.anima as ClassId); return; }
    if (target.dataset.skill) { beginTargeting(target.dataset.skill as SkillId); return; }
    if (target.matches('.command-trigger')) choose(target.closest<HTMLElement>('[data-command]')!.dataset.command as Command);
    else if (target.matches('[data-target], [data-confirm]')) void execute(target.dataset.target);
  });
  root.addEventListener('focusin', () => { if (details) placeDetails(); });
  for (const eventName of ['pointerover', 'focusin']) root.addEventListener(eventName, event => {
    if (!targeting || busy) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-target]');
    if (button && !button.disabled) highlight(button.dataset.target);
  });
  /** Who the click being handled comes from: the mouse and keyboard, unless `control` is pressing for a controller. */
  let pointerPlayer: PlayerId = 1;
  function keydown(event: KeyboardEvent) {
    if (!state || event.metaKey || event.ctrlKey || event.altKey) return;
    if (turnDriver() !== 1 && !['won', 'lost', 'escaped'].includes(state.phase)) { event.preventDefault(); event.stopPropagation(); return; }
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
      else if (selected === 'skill') skillButtons()[index]?.click();
      else if (COMMANDS[index]) choose(COMMANDS[index].id);
    }
    else if (event.key.toLowerCase() === 'i' && !event.repeat) { event.preventDefault(); showDetails(!details); }
    else if (['q', 'e'].includes(event.key.toLowerCase()) && !event.repeat) { event.preventDefault(); changeAnima(event.key.toLowerCase() === 'q' ? -1 : 1); }
    else if (event.key.startsWith('Arrow')) { event.preventDefault(); navigate(event.key.slice(5).toLowerCase() as Direction); }
    event.stopPropagation();
  }
  root.addEventListener('keydown', keydown);
  /**
   * Arrows and the D-pad: up and down walk the column in front of you; right on Habilidad opens
   * its flyout and left closes it again. Picking a target walks every eligible fighter.
   */
  function navigate(direction: Direction) {
    const step = direction === 'up' || direction === 'left' ? -1 : 1;
    const walk = (buttons: HTMLButtonElement[]) => {
      const visible = buttons.filter(b => !b.disabled && b.tabIndex >= 0 && !b.closest('[inert], [hidden]') && b.getClientRects().length);
      const index = visible.indexOf(document.activeElement as HTMLButtonElement);
      visible[index < 0 ? 0 : (index + step + visible.length) % visible.length]?.focus();
    };
    if (targeting) walk(targetButtons());
    else if (selected === 'skill') {
      if (direction === 'left') back();
      else if (direction !== 'right') walk([...root.querySelectorAll<HTMLButtonElement>('.skill-flyout button')]);
    } else if (direction === 'right') { if (document.activeElement === get('[data-command="skill"] .command-trigger')) choose('skill'); }
    else if (direction === 'left') return;
    else walk([...root.querySelectorAll<HTMLButtonElement>('.command-trigger, .battle-result button')]);
  }
  return {
    get controllerContext() { return !state ? 'world' : `battle:${busy ? 'busy' : state.phase}:${selected ?? ''}:${selectedSkill ?? ''}:${targeting}`; },
    /** L / R: the active fighter's previous or next ánima. */
    switchAnima(step: -1 | 1, player: PlayerId = 1) {
      if (!state || busy || player !== turnDriver()) return;
      changeAnima(step);
    },
    /** △ / Y: the details window beside the focused skill. */
    details(player: PlayerId = 1) {
      if (!state || busy || player !== turnDriver()) return;
      showDetails(!details);
    },
    /** A controller press; `player` is whose controller it is. Only the turn's own player is heard. */
    control(action: ControlAction, player: PlayerId = 1) {
      if (!state || busy) return;
      const ended = ['won', 'lost', 'escaped'].includes(state.phase);
      if (!ended && player !== turnDriver()) return;
      if (action === 'cancel') { if (ended) close(); else back(); }
      else if (action === 'confirm') { pointerPlayer = player; try { clickControllerButton(root); } finally { pointerPlayer = 1; } }
      else if (action !== 'menu') navigate(action);
    },
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
    /** `animas` are the party's unlocked ánimas (story.classes); L and R walk through them. */
    open(party: PartySlot[] | 1 | 2, foeCount = 1, options: { possessed?: boolean; encounter?: Encounter; animas?: ClassId[] } = {}) {
      if (state) return;
      previousFocus = document.activeElement as HTMLElement;
      const token = ++generation;
      const { possessed = false, encounter = 'dogs' } = options;
      const slots = typeof party === 'number' ? childParty(party, options.animas?.at(-1)) : party;
      state = encounter === 'palace-minion' ? createMinionBattle(slots[0]?.classId, options.animas) : createBattle(slots, foeCount, possessed, undefined, options.animas); busy = true;
      foeCount = state.foes.length;
      root.toggleAttribute('data-possessed', possessed);
      root.dataset.encounter = encounter;
      get('[data-command="skill"]').classList.remove('is-new');
      get('.class-banner').hidden = true; get('.battle-speech').replaceChildren();
      get('.battle-heading h1').innerHTML = encounter === 'palace-minion' ? 'Un esbirro <em>de verdad.</em>' : possessed ? 'Ojos <em>rosados.</em>' : 'Un pequeño <em>contratiempo.</em>';
      const colour = (f: Combatant, i: number) => f.kind === 'minion' ? '#ff6fae' : DOG_PROFILES[i]?.collar ?? '#b9dba1';
      get('.battle-targets').innerHTML = [...state.foes, ...state.allies].map((f, i) => `<button class="battle-target" type="button" tabindex="-1" data-target="${f.id}" ${i < foeCount ? `data-unit="${f.id}"` : ''} data-side="${i < foeCount ? 'foes' : 'allies'}" style="--dog-color:${colour(f, i)}" aria-label="Elegir a ${f.name}" hidden disabled><span class="enemy-health" aria-hidden="true"><b style="width:100%"></b><i style="width:100%"></i></span>${i < foeCount ? '' : '<span class="enemy-health secondary" aria-hidden="true"><b style="width:100%"></b><i style="width:100%"></i></span>'}</button>`).join('');
      root.dataset.entering = 'true'; delete root.dataset.resolving;
      get('.party-roster').replaceChildren(); get('.battle-pops').replaceChildren(); positions.clear();
      hud.dataset.battle = 'open'; outside().forEach(el => { el.inert = true; });
      root.hidden = false; render(); root.focus({ preventScroll: true });
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
    destroy() { generation++; root.removeEventListener('keydown', keydown); root.remove(); outside().forEach(el => { el.inert = false; }); delete hud.dataset.battle; },
  };
}
