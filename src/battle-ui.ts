import { clickControllerButton, focusControllerButton } from './controller-ui';
import type { ControlAction } from './controller';
import { act, createBattle, enemyAct, nextRound, SKILLS, validTargets, type SkillId, type BattleAction, type BattleEffect, type BattleState, type Combatant } from './battle';
import { DOG_PROFILES } from './encounters';

const COMMANDS: { id: BattleAction; name: string; hint: string; number: string }[] = [
  { id: 'attack', name: 'Atacar', hint: 'Elige un objetivo', number: '01' },
  { id: 'defend', name: 'Defender', hint: 'Prepárate para el golpe', number: '02' },
  { id: 'skill', name: 'Habilidades', hint: 'Primero elige una habilidad', number: '03' },
  { id: 'escape', name: 'Escapar', hint: 'Vuelve a la calle', number: '04' },
];
export function createBattleUI(hud: HTMLElement, callbacks: {
  change: (state: BattleState | undefined, effect?: BattleEffect, onImpact?: () => void) => Promise<void>;
  target: (id?: string) => void;
}) {
  const root = document.createElement('section');
  root.id = 'battle'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Combate por turnos');
  root.innerHTML = `
    <header class="battle-heading"><span class="battle-kicker">ENCUENTRO / PASSATGE MARESME</span><h1>Un pequeño <em>contratiempo.</em></h1></header>
    <div class="round-badge"><span>RONDA</span><strong>01</strong></div>
    <div class="battle-targets" aria-label="Objetivos en la calle"></div>
    <div class="battle-pops" aria-hidden="true"></div>
    <div class="battle-bottom">
      <section class="command-panel" aria-label="Acciones de combate">
        <div class="turn-heading"><span class="turn-dot"></span><span class="turn-label"></span><span class="turn-meta">TU TURNO</span></div>
        <div class="commands">${COMMANDS.map(c => `<article class="command" data-command="${c.id}">
          <button class="command-trigger" type="button" aria-expanded="false" aria-controls="detail-${c.id}"><span class="command-number">${c.number}</span><strong>${c.name}</strong></button>
          <div class="command-expansion" id="detail-${c.id}" inert><div class="command-content"><p>${c.hint}</p><div class="command-choices"></div><button class="command-back" type="button">Volver <span>ESC</span></button></div></div>
        </article>`).join('')}</div>
        <div class="target-picker" hidden><span class="battle-kicker">ELIGE UN OBJETIVO</span><h2></h2><p></p><button class="target-back" type="button">Volver <span>ESC</span></button></div>
        <p class="command-help">1–4 elegir <span>·</span> Enter confirmar <span>·</span> Esc volver</p>
      </section>
      <div class="party-roster" aria-label="Tu equipo"></div>
    </div>
    <section class="battle-result" hidden><span class="battle-kicker">FIN DEL ENCUENTRO</span><h2></h2><p></p><button type="button">Volver a la calle</button></section>`;
  hud.append(root);
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  let state: BattleState | undefined;
  let selected: BattleAction | undefined;
  let selectedSkill: SkillId | undefined;
  let targeting = false;
  let busy = false;
  let generation = 0;
  let previousFocus: HTMLElement | null = null;
  const outside = () => [...hud.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== root);
  const articles = [...root.querySelectorAll<HTMLElement>('.command')];
  function focusFirst() { get<HTMLButtonElement>('.command-trigger').focus({ preventScroll: true }); }
  function meter(c: Combatant, secondary = false) {
    const value = secondary ? c.secondary : c.hp, max = secondary ? c.maxSecondary : c.maxHp;
    const label = secondary ? 'Secundaria' : 'HP';
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
  const targetButtons = () => [...root.querySelectorAll<HTMLButtonElement>('.roster-target:not(:disabled), .battle-target[data-side="foes"]:not(:disabled)')].filter(button => !button.hidden);
  function render() {
    if (!state) return;
    const ended = !busy && ['won', 'lost', 'escaped'].includes(state.phase);
    root.dataset.phase = state.phase;
    get('.battle-heading .battle-kicker').textContent = `ENCUENTRO / ${state.foes.filter(f => f.hp > 0).length} DE ${state.foes.length} PERROS`;
    get('.round-badge strong').textContent = String(state.round).padStart(2, '0');
    get('.turn-label').textContent = state.allies[state.active].name;
    get('.turn-meta').textContent = busy || state.phase === 'enemy' ? 'EN ACCIÓN' : 'TU TURNO';
    // Preserve meter nodes so health changes interpolate instead of snapping.
    const roster = get('.party-roster');
    if (!roster.children.length) roster.innerHTML = state.allies.map((c, i) => `<article class="party-card" data-unit="${c.id}">
      <div class="party-portrait">${i === 0 ? `<img src="${import.meta.env.BASE_URL}portraits/gerard-child.png" alt=""/>` : '<span>B</span>'}</div>
      <div class="unit-info"><div class="unit-heading"><strong>${c.name}</strong><span class="unit-status"></span></div>${meter(c)}${meter(c, true)}</div><button class="roster-target" type="button" data-target="${c.id}" aria-label="Elegir a ${c.name}" hidden></button></article>`).join('');
    for (const c of state.allies) {
      const card = roster.querySelector<HTMLElement>(`[data-unit="${c.id}"]`)!;
      card.classList.toggle('is-active', state.phase === 'player' && state.allies[state.active].id === c.id);
      card.classList.toggle('is-down', c.hp === 0);
      card.classList.toggle('is-acting', root.dataset.actor === c.id);
      card.querySelector('.unit-status')!.textContent = c.hp === 0 ? 'FUERA' : c.guarding ? 'EN GUARDIA' : state.allies[state.active].id === c.id && state.phase === 'player' ? 'ACTIVO' : '';
      card.querySelectorAll<HTMLElement>('.battle-meter').forEach((bar, i) => {
        const value = i === 0 ? c.hp : c.secondary, max = i === 0 ? c.maxHp : c.maxSecondary;
        bar.setAttribute('aria-valuenow', String(value));
        fill(bar, value / max);
        bar.previousElementSibling!.querySelector('strong')!.innerHTML = `${value}<small> / ${max}</small>`;
      });
    }
    for (const foe of state.foes) {
      const plate = get<HTMLButtonElement>(`.battle-target[data-target="${foe.id}"]`);
      fill(plate.querySelector('.enemy-health')!, foe.hp / foe.maxHp);
      const health = foe.hp === 0 ? 'fuera de combate' : foe.hp === foe.maxHp ? 'salud completa' : foe.hp / foe.maxHp <= .3 ? 'salud baja' : 'herido';
      plate.setAttribute('aria-label', `Elegir a ${foe.name}, ${health}`);
      plate.classList.toggle('is-down', foe.hp === 0);
      plate.classList.toggle('is-acting', root.dataset.actor === foe.id);
    }
    articles.forEach(article => { article.querySelector<HTMLButtonElement>('.command-trigger')!.disabled = busy || state!.phase !== 'player'; });
    const eligible = targeting && !busy && state.phase === 'player' ? validTargets(state, selected!, selectedSkill).map(c => c.id) : [];
    root.querySelectorAll<HTMLButtonElement>('[data-target]').forEach(button => {
      button.disabled = !eligible.includes(button.dataset.target!);
      if (button.classList.contains('battle-target')) button.tabIndex = button.disabled ? -1 : 0;
      if (button.classList.contains('roster-target')) button.hidden = !targeting;
      button.closest('[data-unit]')?.classList.toggle('is-eligible', !button.disabled);
    });
    get('.commands').hidden = targeting;
    get('.target-picker').hidden = !targeting;
    get('.command-help').textContent = targeting ? '← ↑ ↓ → elegir · Enter aplicar · Esc volver' : '1–4 elegir · Enter confirmar · Esc volver';
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
    get('.commands').hidden = false; get('.target-picker').hidden = true;
    root.querySelectorAll<HTMLElement>('.roster-target').forEach(button => { button.hidden = true; button.closest('[data-unit]')?.classList.remove('is-eligible'); });
    articles.forEach(article => {
      article.classList.remove('expanded');
      article.querySelector('.command-trigger')!.setAttribute('aria-expanded', 'false');
      article.querySelector<HTMLElement>('.command-expansion')!.inert = true;
    });
    if (restoreFocus && old) get<HTMLButtonElement>(`[data-command="${old}"] .command-trigger`).focus();
  }
  function highlight(id?: string) {
    callbacks.target(id);
    root.querySelectorAll<HTMLElement>('[data-unit], [data-target]').forEach(el => {
      el.classList.toggle('is-targeted', !!id && (el.dataset.unit === id || el.dataset.target === id));
    });
  }
  function expand(action: BattleAction) {
    if (!state || busy || state.phase !== 'player') return;
    if (selected === action) { collapse(true); return; }
    collapse(); selected = action;
    const article = get(`[data-command="${action}"]`);
    article.classList.add('expanded');
    article.querySelector('.command-trigger')!.setAttribute('aria-expanded', 'true');
    article.querySelector<HTMLElement>('.command-expansion')!.inert = false;
    const choices = article.querySelector('.command-choices')!;
    if (action === 'attack') { beginTargeting(); return; }
    if (action === 'skill') {
      choices.innerHTML = SKILLS.map((skill, i) => {
        const affordable = state!.allies[state!.active].secondary >= skill.cost;
        const available = validTargets(state!, 'skill', skill.id).length > 0;
        return `<button type="button" data-skill="${skill.id}" ${!affordable || !available ? 'disabled' : ''}><span><strong>${i + 1} · ${skill.name}</strong><small>${skill.description}</small></span><small>${!affordable ? 'Sin energía' : !available ? 'Equipo al máximo' : `${skill.cost} SEC`}</small></button>`;
      }).join('');
    } else choices.innerHTML = `<button type="button" data-confirm><span>${action === 'defend' ? 'Adoptar guardia' : 'Salir del encuentro'}</span><small>CONFIRMAR</small></button>`;
    render();
    article.querySelector<HTMLButtonElement>('.command-choices button:not(:disabled), .command-back')!.focus({ preventScroll: true });
  }
  function beginTargeting(skill?: SkillId) {
    if (!state || busy || !selected) return;
    if (skill && (state.allies[state.active].secondary < SKILLS.find(s => s.id === skill)!.cost || !validTargets(state, 'skill', skill).length)) return;
    selectedSkill = skill; targeting = true;
    root.dataset.targeting = skill === 'encourage' ? 'allies' : 'foes';
    get('.target-picker h2').textContent = skill ? SKILLS.find(s => s.id === skill)!.name : 'Atacar';
    get('.target-picker p').textContent = skill === 'encourage' ? 'Elige un aliado herido en tu equipo o en la calle.' : 'Elige un perro en la calle.';
    render();
    targetButtons()[0]?.focus({ preventScroll: true });
  }
  function back() {
    if (busy) return;
    if (targeting && selected === 'skill') {
      const oldSkill = selectedSkill;
      collapse(); expand('skill');
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
      else if (effect.skill === 'encourage' && effect.target) pop(effect.target, `+${effect.amount ?? 0}`, 'heal', 'HP');
      else if (effect.target && target) pop(effect.target, `−${effect.amount ?? 0}`, 'damage', target.hp === 0 ? '¡Fuera!' : target.guarding ? 'Protegido' : effect.skill ? 'Impulso' : '');
    });
    if (token === generation) { delete root.dataset.resolving; delete root.dataset.actor; }
  }
  async function execute(target?: string) {
    if (!state || !selected || busy) return;
    if ((selected === 'attack' || selected === 'skill') && !targeting) return;
    const effect = act(state, selected, target, selectedSkill);
    if (!effect) return;
    const token = generation;
    busy = true; collapse(); root.focus({ preventScroll: true });
    await present(effect, token);
    if (token !== generation || !state) return;
    if (state.phase === 'enemy') {
      for (const foe of state.foes.filter(f => f.hp > 0)) {
        const response = enemyAct(state, foe.id);
        if (response) await present(response, token);
        if (token !== generation || !state) return;
      }
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
    if (target.matches('.command-back, .target-back')) { back(); return; }
    if (target.dataset.skill) { beginTargeting(target.dataset.skill as SkillId); return; }
    if (target.matches('.command-trigger')) expand(target.closest<HTMLElement>('[data-command]')!.dataset.command as BattleAction);
    else if (target.matches('[data-target], [data-confirm]')) void execute(target.dataset.target);
  });
  for (const eventName of ['pointerover', 'focusin']) root.addEventListener(eventName, event => {
    if (!targeting || busy) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-target]');
    if (button && !button.disabled) highlight(button.dataset.target);
  });
  function keydown(event: KeyboardEvent) {
    if (!state || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat && document.activeElement instanceof HTMLButtonElement) document.activeElement.click();
    } else if (event.key === 'Tab') {
      const buttons = [...root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(b => b.tabIndex >= 0 && !b.closest('[inert], [hidden]'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'Escape') { event.preventDefault(); back(); }
    else if (/^[1-4]$/.test(event.key) && !event.repeat) {
      event.preventDefault();
      const index = Number(event.key) - 1;
      if (targeting) targetButtons()[index]?.focus();
      else if (selected === 'skill') root.querySelectorAll<HTMLButtonElement>('[data-skill]')[index]?.click();
      else expand(COMMANDS[index].id);
    }
    else if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const buttons = (targeting ? targetButtons() : [...root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]).filter(b => b.tabIndex >= 0 && !b.closest('[inert], [hidden]'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }
    event.stopPropagation();
  }
  root.addEventListener('keydown', keydown);
  return {
    get controllerContext() { return !state ? 'world' : `battle:${busy ? 'busy' : state.phase}:${selected ?? ''}:${selectedSkill ?? ''}:${targeting}`; },
    control(action: ControlAction) {
      if (!state || busy) return;
      if (action === 'cancel') { if (['won', 'lost', 'escaped'].includes(state.phase)) close(); else back(); }
      else if (action === 'confirm') clickControllerButton(root);
      else if (action !== 'menu') {
        if (targeting) {
          const buttons = targetButtons();
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const step = action === 'up' || action === 'left' ? -1 : 1;
          buttons[index < 0 ? 0 : (index + step + buttons.length) % buttons.length]?.focus();
        } else focusControllerButton(root, action);
      }
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
    open(allyCount: 1 | 2, foeCount = 1) {
      if (state) return;
      previousFocus = document.activeElement as HTMLElement;
      const token = ++generation;
      state = createBattle(allyCount, foeCount); busy = true;
      get('.battle-targets').innerHTML = [...state.foes, ...state.allies].map((f, i) => `<button class="battle-target" type="button" tabindex="-1" data-target="${f.id}" ${i < foeCount ? `data-unit="${f.id}"` : ''} data-side="${i < foeCount ? 'foes' : 'allies'}" style="--dog-color:${DOG_PROFILES[i]?.collar ?? '#b9dba1'}" aria-label="Elegir a ${f.name}" hidden disabled>${i < foeCount ? '<span class="enemy-health" aria-hidden="true"><b style="width:100%"></b><i style="width:100%"></i></span>' : ''}</button>`).join('');
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
    destroy() { generation++; root.removeEventListener('keydown', keydown); root.remove(); outside().forEach(el => { el.inert = false; }); delete hud.dataset.battle; },
  };
}
