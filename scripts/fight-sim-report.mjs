/**
 * The balance report (docs/fight-sim.md § The balance report): every mission fight as each story
 * point's party meets it, with and without its answer, the targets, what each foe is made of and
 * every number that can be tuned, as one page. `just fight-sim report` writes it; nothing here
 * decides anything, it only shows what the simulator measured.
 */
import { AFFINITIES, ELEMENTS, FOE_ABILITIES, SKILLS, DUALS } from '../src/battle.ts';
import { BUILDS, DUO, MISSIONS, MISSION_IDS, PAIR, SIM_VERSION, checkTargets, storyPoint, storyRows, tunables, withTuning } from '../src/battle-sim.ts';

const brief = row => ({ win: row.win, winCI: row.winCI, draws: row.draws, rounds: row.rounds, roundsWon: row.roundsWon, roundsLost: row.roundsLost, hpLeftWon: row.hpLeftWon, kos: row.kos, koRate: row.koRate, firstKo: row.firstKo, duals: row.duals, used: row.used, damageShare: row.damageShare, events: row.events, biggest: row.biggest, biggestMax: row.biggestMax });
/** Everything the page shows, as data: pure but for the clock. */
export function balanceData({ runs = 120, seed = 35, tuning = {}, builds = ['nada', 'mixto'], party = DUO, label = '' } = {}) {
  const points = MISSION_IDS.flatMap(id => MISSIONS[id].intro ? [storyPoint(id, 'nada')] : ['first', 'last'].flatMap(order => builds.map(build => storyPoint(`${id}:${order}`, build))));
  const rows = storyRows(points, ['smart', 'casual'], { runs, seed, tuning, party });
  const cells = [];
  for (const r of rows) {
    let cell = cells.find(c => c.fight === r.row.fight && c.at === r.at && c.build === r.build);
    if (!cell) {
      const mission = MISSION_IDS.find(id => MISSIONS[id].fights.includes(r.row.fight));
      cells.push(cell = { fight: r.row.fight, mission, teaching: MISSIONS[mission].teaching.includes(r.row.fight), at: r.at, build: r.build, ecos: r.ecos, spent: r.spent });
    }
    cell[r.row.policy] = brief(r.row);
  }
  for (const cell of cells) cell.holds = cell.smart.win >= PAIR.with && cell.casual.win <= PAIR.without;
  const targets = checkTargets(undefined, runs, seed, tuning).map(t => ({ id: t.id, fight: t.row.fight, party: t.row.party, policy: t.row.policy, ban: t.row.ban, pass: t.pass, failures: t.failures, why: t.why, wanted: t.wanted, win: t.row.win, hpLeftWon: t.row.hpLeftWon, roundsWon: t.row.roundsWon, roundsLost: t.row.roundsLost }));
  const names = { ...Object.fromEntries(SKILLS.map(s => [s.id, s.name])), ...Object.fromEntries(DUALS.map(d => [d.id, `${d.name} (dual)`])), ...Object.fromEntries(Object.entries(FOE_ABILITIES).map(([id, a]) => [id, a.name])), attack: 'Atacar', defend: 'Defender' };
  return {
    version: SIM_VERSION, made: new Date().toISOString(), label, runs, seed, tuning, party, pair: PAIR,
    missions: Object.fromEntries(MISSION_IDS.map(id => [id, { name: MISSIONS[id].name, intro: MISSIONS[id].intro, lights: MISSIONS[id].lights, fights: MISSIONS[id].fights }])),
    points: points.map(p => ({ at: p.at, mission: p.mission, build: p.build, ecos: p.ecos, friends: p.setup.friends, papagato: p.setup.levels.papagato, improved: p.setup.improved })),
    builds: BUILDS, cells, targets, names,
    affinities: Object.entries(AFFINITIES).map(([kind, table]) => ({ kind, weak: Object.entries(table).filter(([, a]) => a === 'weak').map(([e]) => ELEMENTS[e].name), resist: Object.entries(table).filter(([, a]) => a === 'resist').map(([e]) => ELEMENTS[e].name) })),
    numbers: withTuning(tuning, () => tunables()),
  };
}

const CSS = `
:root{color-scheme:light;--bg:#f4f3f0;--surface:#fcfcfb;--line:#dddcd6;--ink:#0b0b0b;--ink2:#52514e;--ink3:#7b7a74;--bar:#2a78d6;--track:#e6e5e0;--good:#0ca30c;--bad:#d03b3b;--warn:#b77d00;--sel:#cde2fb}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#111110;--surface:#1a1a19;--line:#34342f;--ink:#f0efec;--ink2:#c3c2b7;--ink3:#8f8e85;--bar:#3987e5;--track:#2a2a27;--good:#0ca30c;--bad:#e06060;--warn:#fab219;--sel:#104281}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1280px;margin:0 auto;padding:28px 24px 80px}h1{font-size:26px;margin:0 0 4px;letter-spacing:-.01em}h2{font-size:18px;margin:44px 0 6px}h3{font-size:14px;margin:22px 0 8px;color:var(--ink2);text-transform:uppercase;letter-spacing:.06em}
p{margin:6px 0;color:var(--ink2);max-width:78ch}code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--track);padding:1px 5px;border-radius:4px}
.meta{color:var(--ink3);font-size:13px}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:20px 0 6px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.tile b{display:block;font-size:28px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}.tile span{color:var(--ink2);font-size:13px}.tile small{display:block;color:var(--ink3);margin-top:2px}
.filters{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin:14px 0;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:3}
.filters label{color:var(--ink2);font-size:13px;display:flex;gap:6px;align-items:center}select,input[type=search]{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:4px 8px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--surface)}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}thead th{font-size:12px;color:var(--ink2);font-weight:600;background:var(--surface);white-space:nowrap}thead th small{display:block;font-weight:400;color:var(--ink3)}
tbody tr:last-child td{border-bottom:0}td.name{white-space:nowrap;font-weight:600}td.name small{display:block;font-weight:400;color:var(--ink3)}
.cell{display:block;width:100%;min-width:168px;text-align:left;font:inherit;color:inherit;background:none;border:1px solid transparent;border-radius:8px;padding:6px 8px;cursor:pointer}
.cell:hover,.cell:focus-visible{border-color:var(--bar);outline:none}.cell[aria-pressed=true]{background:var(--sel);border-color:var(--bar)}
.meter{display:grid;grid-template-columns:74px 1fr 40px 30px;gap:6px;align-items:center;font-size:12.5px;color:var(--ink2)}.meter i{display:block;height:6px;border-radius:3px;background:var(--track);overflow:hidden}.meter i b{display:block;height:100%;background:var(--bar);border-radius:3px}.meter em{font-style:normal;color:var(--ink);text-align:right}
.verdict{display:flex;gap:6px;align-items:center;font-size:12px;margin-top:4px;color:var(--ink2)}.dot{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;color:#fff;font-size:11px;font-weight:700}.dot.ok{background:var(--good)}.dot.no{background:var(--bad)}.dot.na{background:var(--ink3)}
.delta{color:var(--ink3);font-size:11.5px}
.detail{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;margin-top:10px}.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.card h4{margin:0 0 8px;font-size:14px}
dl{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;margin:0 0 10px}dt{color:var(--ink2)}dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.bars{display:grid;grid-template-columns:minmax(120px,auto) 1fr 44px;gap:5px 8px;align-items:center;font-size:12.5px}.bars span{color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bars i{height:8px;border-radius:0 4px 4px 0;background:var(--bar);display:block;min-width:1px}.bars em{font-style:normal;text-align:right}
.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:1px 8px;font-size:12px;color:var(--ink2);margin:0 4px 4px 0}
#tip{position:fixed;pointer-events:none;background:var(--ink);color:var(--bg);padding:8px 10px;border-radius:8px;font-size:12.5px;max-width:320px;z-index:9;display:none;line-height:1.4}
details{margin:8px 0}summary{cursor:pointer;color:var(--ink2);font-weight:600}.num td:last-child,.num th:last-child{text-align:right}.why{color:var(--ink2);max-width:60ch}.fail{color:var(--bad)}
`;
const APP = `
const $=(s,r=document)=>r.querySelector(s),pc=x=>x==null?'–':Math.round(x*100)+' %',n1=x=>x==null?'–':(Math.round(x*10)/10).toString().replace('.',',');
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const ORDER={first:'la primera',last:'la última'},POL={smart:'Pensando',casual:'Sin pensar'};
const pointName=at=>{const[m,o]=at.split(':');return o?(ORDER[o]??('tras '+o.replaceAll('/',', '))):'introducción'};
const baseCell=c=>BASE?.cells.find(b=>b.fight===c.fight&&b.at===c.at&&b.build===c.build);
const delta=(now,was)=>{if(was==null||now==null)return'';const d=Math.round((now-was)*100);return d?'<span class="delta">'+(d>0?'▲':'▼')+Math.abs(d)+'</span>':''};
let picked=null;
function tiles(){
  const asked=DATA.cells.filter(c=>!c.teaching),held=asked.filter(c=>c.holds).length,pass=DATA.targets.filter(t=>t.pass).length;
  const worst=[...asked].sort((a,b)=>b.casual.win-a.casual.win)[0],hard=[...asked].sort((a,b)=>a.smart.win-b.smart.win)[0];
  $('#tiles').innerHTML=[
    ['Parejas que se cumplen',held+' / '+asked.length,'Pensando ≥ '+pc(DATA.pair.with)+' y sin pensar ≤ '+pc(DATA.pair.without)],
    ['Objetivos del simulador',pass+' / '+DATA.targets.length,'just fight-sim check'],
    ['Más fácil sin pensar',pc(worst.casual.win),worst.fight+' · '+pointName(worst.at)+' · '+worst.build],
    ['Más duro pensando',pc(hard.smart.win),hard.fight+' · '+pointName(hard.at)+' · '+hard.build],
  ].map(([l,v,s])=>'<div class="tile"><span>'+l+'</span><b>'+v+'</b><small>'+esc(s)+'</small></div>').join('');
}
function meter(label,row,was){return '<span class="meter"><span>'+label+'</span><i><b style="width:'+Math.round(row.win*100)+'%"></b></i><em>'+pc(row.win)+'</em>'+((was&&delta(row.win,was.win))||'<span></span>')+'</span>'}
function matrix(){
  const teach=$('#teach').checked,only=$('#mission').value,build=$('#build').value;
  $('#matrix').innerHTML=Object.entries(DATA.missions).filter(([id])=>only==='all'||only===id).map(([id,m])=>{
    const points=DATA.points.filter(p=>p.mission===id&&(m.intro||build==='all'||p.build===build));
    const head=points.map(p=>'<th>'+esc(pointName(p.at))+'<small>'+(m.intro?'sin ecos':p.build+' · '+p.improved.length+' nodos de '+p.ecos+' ecos')+'</small></th>').join('');
    const body=m.fights.filter(f=>teach||!DATA.cells.find(c=>c.fight===f).teaching).map(f=>{
      const first=DATA.cells.find(c=>c.fight===f);
      return '<tr><td class="name">'+esc(f)+(first.teaching?'<small>de enseñar</small>':'')+'</td>'+points.map(p=>{
        const c=DATA.cells.find(x=>x.fight===f&&x.at===p.at&&x.build===p.build),b=baseCell(c),key=[c.fight,c.at,c.build].join('|');
        const v=c.teaching?['na','·','No se le pide'] : c.holds?['ok','✓','Cumple'] : ['no','✗','No cumple'];
        return '<td><button class="cell" data-key="'+key+'" aria-pressed="'+(picked===key)+'">'+meter('Pensando',c.smart,b?.smart)+meter('Sin pensar',c.casual,b?.casual)+'<span class="verdict"><span class="dot '+v[0]+'">'+v[1]+'</span>'+v[2]+'</span></button></td>';
      }).join('')+'</tr>';
    }).join('');
    return '<h3>'+esc(m.name)+(m.intro?' · introducción':' · en cualquier orden')+'</h3><div class="scroll"><table><thead><tr><th>Combate</th>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  }).join('');
}
function stats(row,was){
  const line=(l,v,d='')=>'<dt>'+l+'</dt><dd>'+v+' '+d+'</dd>';
  return '<dl>'+line('Gana',pc(row.win)+' <span class="delta">IC '+pc(row.winCI[0])+'–'+pc(row.winCI[1])+'</span>',was?delta(row.win,was.win):'')+line('Rondas al ganar',n1(row.roundsWon))+line('Rondas al perder',n1(row.roundsLost))+line('PV al ganar',pc(row.hpLeftWon))+line('Cae alguien',pc(row.koRate)+(row.firstKo?' · ronda '+n1(row.firstKo):''))+line('Duales por combate',n1(row.duals))+line('Mayor golpe',Math.round(row.biggest)+' (máx. '+row.biggestMax+')')+(row.draws?line('<span class="fail">Sin acabar</span>',row.draws):'')+'</dl>';
}
function bars(obj,fmt,top=8){
  const list=Object.entries(obj).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,top),max=Math.max(...list.map(([,v])=>v),.0001);
  return list.length?'<div class="bars">'+list.map(([k,v])=>'<span title="'+esc(k)+'">'+esc(DATA.names[k]??k)+'</span><i style="width:'+Math.max(1,v/max*100)+'%"></i><em>'+fmt(v)+'</em>').join('')+'</div>':'<p>Nada.</p>';
}
function detail(){
  const c=DATA.cells.find(x=>[x.fight,x.at,x.build].join('|')===picked);
  if(!c){$('#detail').innerHTML='<p>Elige una casilla de la matriz para ver cómo se juega ese combate.</p>';return}
  const p=DATA.points.find(x=>x.at===c.at&&x.build===c.build),b=baseCell(c);
  $('#detail').innerHTML='<p><b>'+esc(c.fight)+'</b> · '+esc(DATA.missions[c.mission].name)+' · '+esc(pointName(c.at))+'. Ánimas de amigos: '+(p.friends.join(', ')||'ninguna')+'. Papagato '+p.papagato+'. '+p.ecos+' ecos'+(p.improved.length?': '+p.improved.map(i=>'<span class="pill">'+esc(i)+'</span>').join(''):', sin gastar.')+'</p><div class="detail">'+['smart','casual'].map(k=>'<div class="card"><h4>'+POL[k]+'</h4>'+stats(c[k],b?.[k])+'<h3>Daño por acción</h3>'+bars(c[k].damageShare,pc)+'<h3>Lo que más usa</h3>'+bars(c[k].used,n1,6)+'<h3>Lo que hace el enemigo, por combate</h3>'+bars(c[k].events,n1,8)+'</div>').join('')+'</div>';
}
function targets(){
  const q=$('#q').value.toLowerCase(),bad=$('#bad').checked,range=r=>r?pc(r[0])+'–'+pc(r[1]):'';
  $('#targets').innerHTML=DATA.targets.filter(t=>(!bad||!t.pass)&&(t.id+t.fight+t.why).toLowerCase().includes(q)).map(t=>{
    const was=BASE?.targets.find(b=>b.id===t.id);
    return '<tr><td><span class="dot '+(t.pass?'ok">✓':'no">✗')+'</span></td><td class="name">'+esc(t.id)+'<small>'+esc(t.fight)+' · '+esc(t.policy)+(t.ban.length?' · sin '+esc(t.ban.join('/')):'')+'</small></td><td>'+pc(t.win)+' '+(was?delta(t.win,was.win):'')+'</td><td>'+range(t.wanted.win)+'</td><td>'+pc(t.hpLeftWon)+'</td><td>'+n1(t.roundsWon)+'</td><td class="why">'+esc(t.why)+(t.pass?'':'<br><span class="fail">'+esc(t.failures.join('; '))+'</span>')+'</td></tr>';
  }).join('');
}
function numbers(){
  const books={};for(const[path,v]of Object.entries(DATA.numbers)){const[b,id,f]=path.split('.');((books[b]??={})[id]??=[]).push([f,v,path])}
  $('#numbers').innerHTML=Object.entries(books).map(([b,ids])=>'<details'+(b==='marta'||b==='element'?' open':'')+'><summary>'+esc(b)+' · '+Object.values(ids).flat().length+' números</summary><div class="scroll"><table class="num"><thead><tr><th>Qué</th><th>Para --tune</th><th>Ahora</th></tr></thead><tbody>'+Object.entries(ids).flatMap(([id,fs])=>fs.map(([f,v,path])=>{const was=BASE?.numbers[path];return '<tr><td>'+esc(id)+' · '+esc(f)+'</td><td><code>'+esc(path)+'</code></td><td>'+v+(was!=null&&was!==v?' <span class="delta">antes '+was+'</span>':'')+'</td></tr>'})).join('')+'</tbody></table></div></details>').join('');
}
function all(){tiles();matrix();detail();targets()}
document.addEventListener('click',e=>{const cell=e.target.closest('.cell');if(cell){picked=cell.dataset.key;matrix();detail();$('#detail').scrollIntoView({behavior:'smooth',block:'nearest'})}});
document.addEventListener('input',e=>{if(e.target.closest('.filters'))all()});
const tip=$('#tip');
document.addEventListener('mousemove',e=>{const cell=e.target.closest?.('.cell');if(!cell){tip.style.display='none';return}
  const c=DATA.cells.find(x=>[x.fight,x.at,x.build].join('|')===cell.dataset.key);
  tip.innerHTML='<b>'+esc(c.fight)+'</b> · '+esc(pointName(c.at))+' · '+esc(c.build)+'<br>Pensando: '+pc(c.smart.win)+', '+n1(c.smart.roundsWon)+' rondas, '+pc(c.smart.hpLeftWon)+' de PV<br>Sin pensar: '+pc(c.casual.win)+', pierde en '+n1(c.casual.roundsLost)+' rondas';
  tip.style.display='block';tip.style.left=Math.min(e.clientX+14,innerWidth-340)+'px';tip.style.top=(e.clientY+16)+'px'});
$('#mission').innerHTML='<option value="all">Todas</option>'+Object.entries(DATA.missions).map(([id,m])=>'<option value="'+id+'">'+esc(m.name)+'</option>').join('');
$('#build').innerHTML='<option value="all">Todos</option>'+[...new Set(DATA.points.map(p=>p.build))].map(b=>'<option>'+b+'</option>').join('');
$('#aff').innerHTML=DATA.affinities.map(a=>'<tr><td class="name">'+esc(a.kind)+'</td><td>'+(a.weak.join(', ')||'–')+'</td><td>'+(a.resist.join(', ')||'–')+'</td></tr>').join('');
numbers();all();
`;
/** The page, self-contained. `baseline`: an earlier report's data to show what moved since. */
export function balancePage(data, baseline) {
  const when = new Date(data.made).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
  const tuned = Object.entries(data.tuning).map(([k, v]) => `${k}=${v}`).join(' ');
  const embed = value => JSON.stringify(value ?? null).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Balance de combates</title><style>${CSS}</style></head><body><main>
<h1>Balance de combates</h1>
<p class="meta">${when} · ${data.runs} combates por casilla · semilla ${data.seed} · equipo ${data.party}${data.label ? ` · ${data.label}` : ''}${tuned ? ` · probando <code>${tuned}</code>` : ''}${baseline ? ` · comparado con la referencia del ${new Date(baseline.made).toLocaleDateString('es-ES')}` : ' · sin referencia con la que comparar'}</p>
<p>Cada combate, jugado por el equipo que llega a él según la historia: con las ánimas de amigos y los ecos de lo que ya se ha hecho. «Pensando» es el bot que lee el combate; «sin pensar», el que pega a lo que más daño hace. Los bots comparan combinaciones entre sí: no miden cómo se siente un combate.</p>
<div class="tiles" id="tiles"></div>
<h2>Con la respuesta y sin ella</h2>
<p>La regla: pensando se gana al menos el ${Math.round(data.pair.with * 100)} % y sin pensar como mucho el ${Math.round(data.pair.without * 100)} %. Una misión abierta se mide como la primera que se hace y como la última. Pulsa una casilla para ver el detalle.</p>
<div class="filters"><label>Misión <select id="mission"></select></label><label>Gasto de ecos <select id="build"></select></label><label><input type="checkbox" id="teach"> Mostrar los combates de enseñar</label></div>
<div id="matrix"></div>
<h2>Detalle</h2><div id="detail"></div>
<h2>Objetivos del simulador</h2>
<p>Lo que <code>just fight-sim check</code> exige a cada combate, con su equipo elegido a mano.</p>
<div class="filters"><label>Buscar <input type="search" id="q"></label><label><input type="checkbox" id="bad"> Solo los que fallan</label></div>
<div class="scroll"><table><thead><tr><th></th><th>Objetivo</th><th>Gana</th><th>Debe</th><th>PV al ganar</th><th>Rondas</th><th>Por qué</th></tr></thead><tbody id="targets"></tbody></table></div>
<h2>De qué está hecho cada enemigo</h2>
<p>Un golpe con el elemento al que es débil entra ×${data.numbers['element.rules.weak']}; con uno que resiste, ×${data.numbers['element.rules.resist']}.</p>
<div class="scroll"><table><thead><tr><th>Enemigo</th><th>Débil a</th><th>Resiste</th></tr></thead><tbody id="aff"></tbody></table></div>
<h2>Los números</h2>
<p>Todo lo que se puede probar sin tocar el código: <code>just fight-sim report --tune marta.rules.clavado=3</code> rehace esta página con ese número y enseña qué se mueve respecto a la referencia.</p>
<div id="numbers"></div>
<h2>Cómo se usa</h2>
<p><code>just fight-sim report</code> rehace la página. <code>--baseline</code> la guarda además como referencia. <code>--tune libro.id.campo=valor</code> prueba un número. <code>--build nada,mixto,elementos,tronco</code> elige en qué se gastan los ecos. <code>--runs N</code> cambia la precisión.</p>
</main><div id="tip" role="tooltip"></div>
<script>const DATA=${embed(data)},BASE=${embed(baseline)};${APP}</script></body></html>`;
}
