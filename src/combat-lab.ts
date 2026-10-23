import { activeCombatant, createCombat, stepCombat } from './combat/engine.ts';
import { DEFAULT_SIMULATION_CONFIG, createSimulationEncounter, normalizeConfig, simulateRun, type PolicyId, type SimulationConfig, type SimulationReport } from './combat/simulator.ts';
import type { CombatDefinition, CombatEvent, CombatState } from './combat/types.ts';

const root = document.querySelector<HTMLDivElement>('#combat-lab')!;
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const percent = (n: number) => `${(n * 100).toFixed(1)} %`;
const labels: Record<PolicyId, string> = { basic: 'Solo ataque', random: 'Aleatoria', tactical: 'Táctica' };
const policyOptions = Object.entries(labels).map(([value, label]) => `<option value="${value}" ${value === 'tactical' ? 'selected' : ''}>${label}</option>`).join('');
root.innerHTML = `
  <header class="topbar"><div class="brand"><div class="brand-mark" aria-hidden="true"><span>35</span></div><b>GERARD 35</b><em>Herramientas de diseño</em></div><a href="./">Volver al juego ↗</a></header>
  <div class="layout">
    <aside class="sidebar"><p class="eyebrow">Configuración del ensayo</p><h2>El peso de cada turno.</h2><p class="subtle">Cambia las condiciones. Compara decisiones. Repite el resultado.</p>
      <form id="config">
        <fieldset><legend>Muestra reproducible</legend><div class="pair"><label>Combates / estrategia<input name="runs" type="number" value="200" min="1" max="5000" step="1" required></label><label>Semilla base<input name="seed" type="number" value="3517" min="0" max="4294967295" step="1" required></label></div>
        <label>Estrategia enemiga<select name="enemyPolicy">${policyOptions}</select></label></fieldset>
        <fieldset><legend>Presión del encuentro</legend>
        <label><span class="slider-head">Vida enemiga<output id="hp-value">1.00×</output></span><input name="enemyHp" aria-label="Multiplicador de vida enemiga" type="range" min="0.5" max="2" value="1" step="0.05"></label>
        <label><span class="slider-head">Daño directo rival<output id="power-value">1.00×</output></span><input name="enemyPower" aria-label="Multiplicador de daño directo rival" type="range" min="0.5" max="2" value="1" step="0.05"></label>
        <label>Límite de rondas<input name="maxRounds" type="number" value="80" min="1" max="500" step="1" required></label></fieldset>
        <div class="actions"><button class="primary" id="run" type="submit">Simular las 3 estrategias →</button><button type="button" id="cancel" hidden>Cancelar simulación</button><button type="button" id="export" disabled>↓ Exportar informe JSON</button></div>
      </form>
      <p class="subtle note">Escenario mecánico de prueba. Sus unidades, etiquetas y cifras son provisionales; no fijan los tipos ni la dificultad de la campaña.</p>
    </aside>
    <main class="workspace">
      <div class="heading"><div><p class="eyebrow">SISTEMA DE COMBATE / ENSAYO 01</p><h1>Laboratorio de combate</h1><p>Un mismo encuentro, distintas decisiones. La dificultad se mide también en lo que cuesta ganar.</p></div><span class="badge">CONTENIDO PROVISIONAL</span></div>
      <p class="run-status" id="status" role="status" aria-live="polite">Preparando el primer ensayo…</p>
      <section class="metrics" aria-label="Resultados de la estrategia táctica" id="metrics">
        ${['Victorias · táctica', 'Rondas de combate', 'Vida restante', 'Bajas del equipo'].map(label => `<div class="metric"><span class="eyebrow">${label}</span><strong>—</strong><small>Esperando resultados</small></div>`).join('')}
      </section>
      <section class="panel" aria-labelledby="comparison-title"><div class="panel-head"><div><h2 id="comparison-title">¿Cuánto importa jugar bien?</h2><p class="subtle" id="comparison-subtitle">Las tres estrategias comparten exactamente las mismas semillas.</p></div><div class="legend" aria-label="Leyenda"><span>Victoria</span><span>Derrota</span><span>Empate</span></div></div>
        <table class="comparison"><thead><tr><th>Estrategia aliada</th><th>Resultado de todos los combates</th><th>Victorias · IC 95 %</th><th>Rondas</th></tr></thead><tbody id="comparison-body"></tbody></table>
        <p class="interpretation" id="interpretation">El intervalo expresa incertidumbre entre semillas; las estrategias automáticas no sustituyen pruebas con jugadores.</p>
      </section>
      <section class="panel" aria-labelledby="replay-title"><div class="panel-head"><div><h2 id="replay-title">Una pelea, decisión a decisión</h2><p class="subtle" id="replay-subtitle">Semilla, acciones y efectos reproducibles.</p></div>
        <form id="replay-form" class="replay-tools"><label>Estrategia<select id="replay-policy">${policyOptions}</select></label><label>Semilla de la pelea<input type="number" id="replay-seed" value="3517" min="0" max="4294967295" step="1" required></label><button type="submit" id="replay-run" disabled>Repetir</button><button type="button" id="replay-loss" disabled>Ver derrota</button></form></div>
        <div class="replay-layout"><div class="arena" id="arena"><p class="empty">El primer combate aparecerá aquí.</p></div><div class="replay-log"><h3>REGISTRO DE EFECTOS</h3><ol id="event-log" aria-label="Registro del combate"></ol></div></div>
        <div class="playback"><button id="rewind" aria-label="Volver al inicio" disabled>↤</button><button id="previous" aria-label="Acción anterior" disabled>←</button><button id="play" aria-label="Reproducir combate" disabled>▶</button><button id="next" aria-label="Siguiente acción" disabled>→</button><input id="scrub" type="range" min="0" max="1" value="0" aria-label="Acción de la repetición" disabled><output id="replay-position">Acción 0 / 0</output></div>
      </section>
      <details class="panel editor"><summary>Editar la definición del encuentro</summary><p class="subtle">JSON compartido por el motor y el simulador. Añade recursos, acciones, afinidades o estados sin tocar la interfaz. El laboratorio usa un equipo <code>party</code> y un equipo rival. Los multiplicadores se aplican sobre esta base.</p><textarea id="definition" aria-label="Definición JSON del encuentro" spellcheck="false"></textarea><div class="editor-controls"><button id="apply-definition">Validar y simular</button><button id="reset-definition">Restaurar ejemplo</button><span id="definition-name"></span></div></details>
      <p class="footer-note">Motor local y determinista · Sin llamadas a IA · Sin modificar partidas guardadas · El informe incluye reglas, parámetros y semillas.</p>
    </main>
  </div>`;

const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
const form = get<HTMLFormElement>('#config');
const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
const defaults = normalizeConfig(DEFAULT_SIMULATION_CONFIG);
for (const name of ['runs', 'seed', 'enemyPolicy', 'enemyHp', 'enemyPower', 'maxRounds'] as const) field(name).value = String(defaults[name]);
let baseline = createSimulationEncounter({ ...defaults, enemyHp: 1, enemyPower: 1 });
const originalBaseline = structuredClone(baseline);
let reports: SimulationReport[] = [];
let worker: Worker | undefined;
let generation = 0;
let replayStates: CombatState[] = [];
let replayDefinition: CombatDefinition | undefined;
let replayEvents: CombatEvent[][] = [];
let cursor = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function message(text: string, error = false) {
  get('#status').textContent = text;
  get('#status').dataset.error = String(error);
}
function configuration(): SimulationConfig {
  return normalizeConfig({ runs: Number(field('runs').value), seed: Number(field('seed').value), policy: 'tactical', enemyPolicy: field('enemyPolicy').value as PolicyId, enemyHp: Number(field('enemyHp').value), enemyPower: Number(field('enemyPower').value), maxRounds: Number(field('maxRounds').value) });
}
function writeDefinition() {
  get<HTMLTextAreaElement>('#definition').value = JSON.stringify(baseline, null, 2);
  get('#definition-name').textContent = baseline.name ?? baseline.id;
}
function stopPlayback() {
  clearInterval(timer); timer = undefined;
  get('#play').textContent = '▶'; get('#play').setAttribute('aria-label', 'Reproducir combate');
}
function setBusy(busy: boolean) {
  get<HTMLButtonElement>('#run').disabled = busy;
  get('#cancel').hidden = !busy;
  // Lock parameters while a worker owns a snapshot so the visible result stays attributable.
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select').forEach(input => { input.disabled = busy; });
  get<HTMLButtonElement>('#apply-definition').disabled = busy;
  get<HTMLButtonElement>('#reset-definition').disabled = busy;
  root.dataset.running = String(busy);
}
function simulate() {
  if (!form.reportValidity()) return;
  let config: SimulationConfig;
  try { config = configuration(); createCombat(baseline, config.seed); } catch (error) { message(String(error), true); return; }
  worker?.terminate(); stopPlayback(); setBusy(true);
  const run = ++generation;
  message(`Simulando ${config.runs * 3} combates… 0 / 3 estrategias.`);
  worker = new Worker(new URL('./combat-lab-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = event => {
    if (run !== generation) return;
    const data = event.data;
    if (data.type === 'progress') message(`Simulando ${config.runs * 3} combates… ${data.completed} / ${data.total} estrategias.`);
    else if (data.type === 'error') { message(data.message, true); setBusy(false); worker?.terminate(); worker = undefined; }
    else if (data.type === 'complete') {
      reports = data.reports;
      setBusy(false); worker?.terminate(); worker = undefined;
      get<HTMLButtonElement>('#export').disabled = false;
      get<HTMLButtonElement>('#replay-run').disabled = false;
      get<HTMLButtonElement>('#replay-loss').disabled = false;
      root.dataset.ready = 'true';
      message(`${config.runs * 3} combates completados · ${config.runs} por estrategia · semilla base ${config.seed} · vida ×${config.enemyHp.toFixed(2)} · daño directo ×${config.enemyPower.toFixed(2)}.`);
      renderResults();
      get<HTMLInputElement>('#replay-seed').value = String(reports[0].runs[0].seed);
      loadReplay();
    }
  };
  worker.onerror = event => { message(event.message || 'No se pudo ejecutar la simulación.', true); setBusy(false); worker?.terminate(); worker = undefined; };
  worker.postMessage({ config, baseline });
}
function renderResults() {
  const tactical = reports.find(report => report.config.policy === 'tactical')!;
  const s = tactical.summary;
  const metrics = [
    ['Victorias · táctica', percent(s.winRate), `IC 95 %: ${percent(s.winRateCI[0])} – ${percent(s.winRateCI[1])}`],
    ['Rondas de combate', s.meanRounds.toFixed(1), `${s.meanActions.toFixed(1)} acciones de media`],
    ['Vida restante', percent(s.meanPartyHpRemaining), 'Media sobre todos los combates'],
    ['Bajas del equipo', s.meanPartyCasualties.toFixed(2), `${s.meanResourceSpent.toFixed(1)} recursos gastados / pelea`],
  ];
  get('#metrics').innerHTML = metrics.map(([label, value, note]) => `<div class="metric"><span class="eyebrow">${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  get('#comparison-body').innerHTML = reports.map(({ config, summary: summary }) => `<tr class="${config.policy === 'tactical' ? 'selected' : ''}"><td>${labels[config.policy]}</td><td><div class="stack" role="img" aria-label="${summary.wins} victorias, ${summary.losses} derrotas, ${summary.draws} empates"><span style="width:${summary.winRate * 100}%"></span><span style="width:${summary.lossRate * 100}%"></span><span style="width:${summary.drawRate * 100}%"></span></div></td><td>${percent(summary.winRate)} <span class="subtle">[${(summary.winRateCI[0] * 100).toFixed(0)}–${(summary.winRateCI[1] * 100).toFixed(0)}]</span></td><td>${summary.meanRounds.toFixed(1)}</td></tr>`).join('');
  get('#comparison-subtitle').textContent = `${tactical.config.runs} combates por estrategia · rival ${labels[tactical.config.enemyPolicy].toLowerCase()} · mismas semillas`;
  const basic = reports.find(report => report.config.policy === 'basic')!;
  const gap = (s.winRate - basic.summary.winRate) * 100;
  const drawCount = reports.reduce((sum, report) => sum + report.summary.draws, 0);
  get('#interpretation').textContent = `La estrategia táctica obtiene ${gap >= 0 ? '+' : ''}${gap.toFixed(1)} puntos de victoria frente a usar solo ataques. ${drawCount ? `${drawCount} empates por límites o eliminación simultánea; consulta sus causas en el informe. ` : ''}Es una comparación entre agentes de prueba; valida el reto jugando antes de fijar el equilibrio.`;
}
function selectedReport() { return reports.find(report => report.config.policy === get<HTMLSelectElement>('#replay-policy').value); }
function loadReplay(seed?: number) {
  const report = selectedReport();
  if (!report) return;
  const input = get<HTMLInputElement>('#replay-seed');
  if (seed !== undefined) input.value = String(seed);
  if (!input.reportValidity()) return;
  stopPlayback();
  try {
    const result = simulateRun(report.config, Number(input.value), report.encounter, true);
    const replay = result.replay!;
    replayDefinition = report.encounter;
    let state = createCombat(replayDefinition, replay.seed);
    replayStates = [state]; replayEvents = [state.events];
    for (const command of replay.commands) {
      const transition = stepCombat(replayDefinition, state, command);
      if (!transition.accepted) throw new Error(`Repetición incompatible: ${transition.reason}`);
      state = transition.state; replayStates.push(state); replayEvents.push(transition.events);
    }
    cursor = 0;
    const outcome = result.outcome === 'win' ? 'victoria' : result.outcome === 'loss' ? 'derrota' : 'empate';
    get('#replay-subtitle').textContent = `Semilla ${replay.seed} · ${labels[report.config.policy]} · ${outcome} · ${result.rounds} rondas`;
    get<HTMLInputElement>('#scrub').max = String(replayStates.length - 1);
    renderReplay();
  } catch (error) { message(String(error), true); }
}
function describe(event: CombatEvent) {
  const name = (id?: string) => replayDefinition?.combatants.find(unit => unit.id === id)?.name ?? id ?? '';
  const action = event.actionId ? replayDefinition?.actions[event.actionId]?.name ?? event.actionId : '';
  const status = event.statusId ? replayDefinition?.statuses?.[event.statusId]?.name ?? event.statusId : '';
  switch (event.type) {
    case 'action': return `${name(event.actorId)} → ${action}`;
    case 'damage': return `${name(event.targetId)}: −${event.amount} PV`;
    case 'heal': return `${name(event.targetId)}: +${event.amount} PV`;
    case 'resource': return `${name(event.targetId)}: ${(event.amount ?? 0) > 0 ? '+' : ''}${event.amount} ${event.resource}`;
    case 'status': return `${name(event.targetId)} recibe ${status}`;
    case 'status-removed': return `${name(event.targetId)} pierde ${status}`;
    case 'defeated': return `${name(event.targetId)} cae`;
    case 'revive': return `${name(event.targetId)} vuelve al combate`;
    case 'reaction': return `${name(event.actorId)} reacciona: ${status}`;
    case 'miss': return `No se activa el efecto sobre ${name(event.targetId)}`;
    case 'wait': return `${name(event.actorId)} espera`;
    case 'finished': return `Fin del combate · ${event.detail ?? ''}`;
    default: return undefined;
  }
}
function renderReplay() {
  const state = replayStates[cursor];
  if (!state || !replayDefinition) return;
  const health = replayDefinition.rules?.healthResource ?? 'hp';
  const active = activeCombatant(state)?.id;
  const unitHTML = (enemy: boolean) => state.combatants.filter(unit => (unit.team !== 'party') === enemy).map((unit, i) => {
    const hp = unit.resources[health];
    const statuses = unit.statuses.map(status => `${replayDefinition!.statuses?.[status.id]?.name ?? status.id}${status.stacks > 1 ? ` ×${status.stacks}` : ''}${status.remaining !== undefined ? ` · ${status.remaining}t` : ''}`);
    return `<article class="unit ${enemy ? 'enemy' : ''} ${unit.id === active ? 'active' : ''} ${hp.current <= 0 ? 'dead' : ''}"><div class="unit-title"><span class="unit-token">${enemy ? 'R' : 'A'}${i + 1}</span><div><b>${escape(unit.name)}</b><small>${hp.current <= 0 ? 'Fuera de combate' : unit.id === active ? 'Turno actual' : 'En combate'}</small></div></div>${Object.entries(unit.resources).map(([key, resource]) => `<div class="resource-line"><span>${escape(key === health ? 'PV' : key)}</span><span>${resource.current} / ${resource.max}</span></div><div class="resource-bar ${key !== health ? 'secondary' : ''}"><span style="width:${resource.max ? Math.min(100, 100 * resource.current / resource.max) : 0}%"></span></div>`).join('')}<p class="statuses">${escape(statuses.join(' / ') || 'Sin estados')}</p></article>`;
  }).join('');
  get('#arena').innerHTML = `<div><p class="team-heading">Equipo de prueba</p>${unitHTML(false)}</div><span class="versus">VS</span><div><p class="team-heading">Oposición</p>${unitHTML(true)}</div>`;
  const messages = replayEvents.slice(0, cursor + 1).flat().map(describe).filter((line): line is string => !!line).slice(-70);
  get('#event-log').innerHTML = messages.length ? messages.map(line => `<li>${escape(line)}</li>`).join('') : '<li>Empieza el encuentro. La iniciativa depende de la velocidad.</li>';
  const log = get('#event-log'); log.scrollTop = log.scrollHeight;
  get<HTMLOutputElement>('#replay-position').value = `Acción ${cursor} / ${replayStates.length - 1}`;
  get<HTMLInputElement>('#scrub').value = String(cursor);
  get<HTMLInputElement>('#scrub').disabled = replayStates.length < 2;
  get<HTMLButtonElement>('#rewind').disabled = cursor === 0;
  get<HTMLButtonElement>('#previous').disabled = cursor === 0;
  get<HTMLButtonElement>('#next').disabled = cursor === replayStates.length - 1;
  get<HTMLButtonElement>('#play').disabled = replayStates.length < 2;
}

form.onsubmit = event => { event.preventDefault(); simulate(); };
form.oninput = () => {
  get('#hp-value').textContent = `${Number(field('enemyHp').value).toFixed(2)}×`;
  get('#power-value').textContent = `${Number(field('enemyPower').value).toFixed(2)}×`;
  if (reports.length) message('Parámetros modificados. Los resultados visibles corresponden al ensayo anterior; vuelve a simular.');
};
get('#cancel').onclick = () => { generation++; worker?.terminate(); worker = undefined; setBusy(false); message('Simulación cancelada. Se conservan los últimos resultados completos.'); };
get('#export').onclick = () => {
  if (!reports.length) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'gerard-combat-lab', version: 1, reports }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `combat-${reports[0].config.seed}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
get<HTMLFormElement>('#replay-form').onsubmit = event => { event.preventDefault(); loadReplay(); };
get('#replay-policy').onchange = () => loadReplay();
get('#replay-loss').onclick = () => {
  const seed = selectedReport()?.runs.find(run => run.outcome === 'loss')?.seed;
  if (seed === undefined) message('Esta estrategia no perdió en la muestra del último ensayo.');
  else loadReplay(seed);
};
get('#rewind').onclick = () => { stopPlayback(); cursor = 0; renderReplay(); };
get('#previous').onclick = () => { stopPlayback(); cursor = Math.max(0, cursor - 1); renderReplay(); };
get('#next').onclick = () => { stopPlayback(); cursor = Math.min(replayStates.length - 1, cursor + 1); renderReplay(); };
get<HTMLInputElement>('#scrub').oninput = event => { stopPlayback(); cursor = Number((event.target as HTMLInputElement).value); renderReplay(); };
get('#play').onclick = () => {
  if (timer) { stopPlayback(); return; }
  if (cursor === replayStates.length - 1) cursor = 0;
  get('#play').textContent = 'Ⅱ'; get('#play').setAttribute('aria-label', 'Pausar combate');
  timer = setInterval(() => { cursor++; renderReplay(); if (cursor >= replayStates.length - 1) stopPlayback(); }, 550);
};
get('#apply-definition').onclick = () => {
  try {
    const candidate = JSON.parse(get<HTMLTextAreaElement>('#definition').value) as CombatDefinition;
    createCombat(candidate, 1);
    // Simulator checks its narrower two-team contract before accepting an editor change.
    createSimulationEncounter(configuration(), candidate);
    baseline = candidate; writeDefinition(); simulate();
  } catch (error) { message(`Definición no válida: ${String(error)}`, true); }
};
get('#reset-definition').onclick = () => { baseline = structuredClone(originalBaseline); writeDefinition(); simulate(); };
window.addEventListener('pagehide', () => { worker?.terminate(); stopPlayback(); });
writeDefinition();
simulate();
