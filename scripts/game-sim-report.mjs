/**
 * The whole-game report (docs/game-sim.md § The report): many playthroughs of each simulated player,
 * as one page. `just game-sim report` writes it; nothing here decides anything, it only shows what
 * the simulator measured. Its data is saved beside it as `data.json`, which the picker reads too.
 */
const CSS = `
:root{color-scheme:light;--bg:#f4f3f0;--surface:#fcfcfb;--line:#dddcd6;--ink:#0b0b0b;--ink2:#52514e;--ink3:#7b7a74;--track:#e6e5e0;--grid:#e9e8e3;
--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--good:#0ca30c;--bad:#d03b3b;--warn:#b77d00}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#111110;--surface:#1a1a19;--line:#34342f;--ink:#f0efec;--ink2:#c3c2b7;--ink3:#8f8e85;--track:#2a2a27;--grid:#262624;
--s1:#3987e5;--s2:#d95926;--s3:#199e70;--good:#0ca30c;--bad:#e06060;--warn:#fab219}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1240px;margin:0 auto;padding:28px 24px 80px}h1{font-size:26px;margin:0 0 4px;letter-spacing:-.01em}h2{font-size:18px;margin:44px 0 6px}
p{margin:6px 0;color:var(--ink2);max-width:80ch}code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--track);padding:1px 5px;border-radius:4px}
.meta{color:var(--ink3);font-size:13px}.players{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;margin:18px 0}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.card h3{margin:0 0 10px;font-size:15px;display:flex;gap:8px;align-items:center}
.key{display:inline-block;width:12px;height:12px;border-radius:3px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.tile b{display:block;font-size:22px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}.tile span{color:var(--ink2);font-size:12.5px}.tile small{display:block;color:var(--ink3);font-size:12px}
.chart{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px;position:relative}
.chart svg{display:block;width:100%;height:auto;overflow:visible}.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--ink2);margin:4px 0 8px}.legend span{display:flex;gap:6px;align-items:center}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(520px,1fr));gap:14px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--surface)}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{padding:7px 10px;text-align:left;border-bottom:1px solid var(--line);vertical-align:middle}thead th{font-size:12px;color:var(--ink2);font-weight:600;white-space:nowrap}tbody tr:last-child td{border-bottom:0}
td.name{font-weight:600;white-space:nowrap}td small{color:var(--ink3)}.bar{display:grid;grid-template-columns:1fr 64px;gap:8px;align-items:center}.bar i{display:block;height:8px;border-radius:0 4px 4px 0;min-width:1px}
.meter{display:grid;grid-template-columns:70px 44px;gap:6px;align-items:center}.meter i{display:block;height:6px;border-radius:3px;background:var(--track);overflow:hidden}.meter i b{display:block;height:100%;background:var(--ink2);border-radius:3px}
.flag{font-size:12px;font-weight:600;border-radius:999px;padding:1px 8px;white-space:nowrap}.flag.wall{color:var(--bad);border:1px solid var(--bad)}.flag.easy{color:var(--ink3);border:1px solid var(--line)}
.tabs{display:flex;gap:6px;margin:10px 0}.tabs button{font:inherit;border:1px solid var(--line);background:var(--surface);color:var(--ink2);border-radius:999px;padding:3px 12px;cursor:pointer}.tabs button[aria-pressed=true]{color:var(--ink);border-color:var(--ink2)}
ul.gaps{margin:6px 0;padding-left:20px;color:var(--ink2)}#tip{position:fixed;pointer-events:none;background:var(--ink);color:var(--bg);padding:8px 10px;border-radius:8px;font-size:12.5px;max-width:320px;z-index:9;display:none;line-height:1.4}
`;
const APP = `
const $=(s,r=document)=>r.querySelector(s),pc=x=>x==null?'–':Math.round(x*100)+' %',mn=x=>x==null?'–':Math.round(x)+' min',n1=x=>x==null?'–':(Math.round(x*10)/10).toString().replace('.',',');
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const COLORS=['var(--s1)','var(--s2)','var(--s3)'],colorOf=i=>COLORS[i%COLORS.length];
const tip=$('#tip');function show(e,html){tip.innerHTML=html;tip.style.display='block';tip.style.left=Math.min(innerWidth-330,e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px'}function hide(){tip.style.display='none'}
function cards(){
  $('#players').innerHTML=DATA.players.map((p,i)=>'<div class="card"><h3><i class="key" style="background:'+colorOf(i)+'"></i>'+esc(p.name)+' <small class="meta">'+p.runs+' partidas · bot '+p.policy+'</small></h3><div class="tiles">'+[
    ['Duración',mn(p.minutes.p50),'p10 '+mn(p.minutes.p10)+' · p90 '+mn(p.minutes.p90)],
    ['Días en Barcelona',n1(p.days.mean),'máximo '+p.days.max],
    ['Combates',n1(p.fights),n1(p.losses)+' perdidos'],
    ['Rebobinados',n1(p.rewinds.mean),'máximo '+p.rewinds.max+' (la Reina lo cubre todo)'],
    ['Se satura',p.saturation?pc(p.saturation.at):'no','desde el min '+(p.saturation?p.saturation.minute:'–')],
    ['Terminan',pc(p.finished),Object.entries(p.reasons).map(([r,n])=>r+': '+n).join('; ')||'la ruta entera'],
  ].map(([l,v,s])=>'<div class="tile"><span>'+l+'</span><b>'+v+'</b><small>'+esc(s)+'</small></div>').join('')+'</div></div>').join('');
}
/** A line per player over the game's tenths: one axis, 0 to 1. */
function lines(el,field,label){
  const W=560,H=230,L=40,R=86,T=10,B=28,x=i=>L+(W-L-R)*(i+.5)/10,y=v=>T+(H-T-B)*(1-v),ends=[];
  let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(label)+'">';
  for(const v of [0,.25,.5,.75,1])svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--grid)"/><text x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end" font-size="11" fill="var(--ink3)">'+Math.round(v*100)+'</text>';
  for(let i=0;i<10;i+=3)svg+='<text x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="var(--ink3)">'+(i*10)+'–'+(i*10+10)+' %</text>';
  DATA.players.forEach((p,k)=>{const pts=p.curve.map((c,i)=>c[field]==null?null:[x(i),y(c[field])]).filter(Boolean);
    svg+='<polyline fill="none" stroke="'+colorOf(k)+'" stroke-width="2" stroke-linejoin="round" points="'+pts.map(q=>q.join(',')).join(' ')+'"/>';
    for(const q of pts)svg+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="4" fill="'+colorOf(k)+'" stroke="var(--surface)" stroke-width="2"/>';
    if(pts.length)ends.push({k,y:pts.at(-1)[1],name:p.name});});
  // Direct labels at the right end, pushed apart so they never sit on each other.
  ends.sort((a,b)=>a.y-b.y);for(let i=1;i<ends.length;i++)ends[i].y=Math.max(ends[i].y,ends[i-1].y+13);
  for(const e of ends)svg+='<text x="'+(W-R+4)+'" y="'+(e.y+4)+'" font-size="11.5" fill="var(--ink2)">'+esc(e.name)+'</text>';
  for(let i=0;i<10;i++)svg+='<rect class="hit" data-i="'+i+'" x="'+(x(i)-(W-L-R)/20)+'" y="'+T+'" width="'+(W-L-R)/10+'" height="'+(H-T-B)+'" fill="transparent"/>';
  el.innerHTML='<div class="legend">'+DATA.players.map((p,k)=>'<span><i class="key" style="background:'+colorOf(k)+'"></i>'+esc(p.name)+'</span>').join('')+'</div>'+svg+'</svg>';
  el.querySelectorAll('.hit').forEach(r=>{r.addEventListener('mousemove',e=>{const i=+r.dataset.i;show(e,'<b>'+(i*10)+'–'+(i*10+10)+' % de la partida</b><br>'+DATA.players.map(p=>{const c=p.curve[i];return esc(p.name)+': '+pc(c[field])+' <small>('+c.fights+' combates, '+pc(c.lossRate)+' perdidos)</small>'}).join('<br>'))});r.addEventListener('mouseleave',hide)});
}
function time(){
  const kinds=Object.keys(DATA.players[0].time),max=Math.max(...DATA.players.flatMap(p=>kinds.map(k=>p.time[k]??0)),1);
  $('#time').innerHTML='<table><thead><tr><th>En qué</th>'+DATA.players.map((p,k)=>'<th><i class="key" style="background:'+colorOf(k)+'"></i> '+esc(p.name)+'</th>').join('')+'</tr></thead><tbody>'+
    kinds.map(k=>'<tr><td class="name">'+esc(DATA.kinds[k])+'</td>'+DATA.players.map((p,i)=>'<td><span class="bar"><i style="width:'+Math.max(1,(p.time[k]??0)/max*100)+'%;background:'+colorOf(i)+'"></i><span>'+mn(p.time[k])+'</span></span></td>').join('')+'</tr>').join('')+'</tbody></table>';
}
function levels(){
  const rows=DATA.players[0].levels.map((_,i)=>i);
  $('#levels').innerHTML='<table><thead><tr><th>Ánima y nivel</th>'+DATA.players.map(p=>'<th>'+esc(p.name)+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map(i=>{const l=DATA.players[0].levels[i];return '<tr><td class="name">'+esc(l.anima)+' '+l.level+(l.level===DATA.maxLevel?' <small>(tope)</small>':'')+'</td>'+DATA.players.map(p=>{const v=p.levels[i];return '<td>'+(v.reached?'min '+n1(v.minute)+' · el '+pc(v.at)+' de la partida <small>(combate '+n1(v.fight)+', en el '+pc(v.reached)+' de partidas)</small>':'<small>nunca</small>')+'</td>'}).join('')+'</tr>'}).join('')+
    '<tr><td class="name">EXP ganada ya en el tope</td>'+DATA.players.map(p=>'<td>'+(p.wasted??'–')+' EXP por partida</td>').join('')+'</tr></tbody></table>';
}
let pick=0;
function encounters(){
  $('#enc-tabs').innerHTML=DATA.players.map((p,i)=>'<button aria-pressed="'+(i===pick)+'" data-i="'+i+'">'+esc(p.name)+'</button>').join('');
  $('#enc-tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{pick=+b.dataset.i;encounters();sample()});
  const p=DATA.players[pick],meter=v=>v==null?'–':'<span class="meter"><i><b style="width:'+Math.round(v*100)+'%"></b></i><span>'+pc(v)+'</span></span>';
  $('#encounters').innerHTML='<table><thead><tr><th>Combate</th><th>Tramo</th><th>Veces por partida</th><th>Gana a la primera</th><th>Gana</th><th>Intentos hasta ganar</th><th>PV al ganar</th><th>Rondas</th><th>Trivial</th><th></th></tr></thead><tbody>'+
    p.encounters.map(e=>'<tr><td class="name">'+esc(DATA.names[e.encounter]??e.encounter)+'<br><small>'+esc(e.encounter)+'</small></td><td>'+esc(e.stage)+'</td><td>'+n1(e.met)+' <small>(en el '+pc(e.games)+')</small></td><td>'+meter(e.firstWin)+'</td><td>'+meter(e.win)+'</td><td>'+n1(e.tries)+'</td><td>'+pc(e.hpLeft)+'</td><td>'+n1(e.rounds)+'</td><td>'+pc(e.trivial)+'</td><td>'+(e.taken>0?'<span class="flag easy">toma a Aitor en el '+pc(e.taken)+'</span>':p.walls.includes(e.encounter)?'<span class="flag wall">✕ muro</span>':e.trivial>=.8?'<span class="flag easy">ya no pregunta</span>':'')+(e.learnt>0?' <small>aprendido '+pc(e.learnt)+'</small>':'')+'</td></tr>').join('')+'</tbody></table>';
}
/** The median game of the picked player: each fight where it came (minute) and how hard it was, the levels and the falls. */
function sample(){
  const p=DATA.players[pick],s=p.sample,W=1100,H=250,L=40,R=16,T=18,B=30,end=Math.max(1,s.minutes),x=t=>L+(W-L-R)*Math.min(1,t/60/end),y=v=>T+(H-T-B)*(1-v);
  let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Una partida típica">';
  for(const v of [0,.5,1])svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--grid)"/><text x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end" font-size="11" fill="var(--ink3)">'+Math.round(v*100)+'</text>';
  const step=end>240?60:end>90?30:15;for(let m=0;m<=end;m+=step)svg+='<text x="'+x(m*60)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="var(--ink3)">'+m+' min</text>';
  for(const m of s.moments.filter(m=>m.kind==='level'))svg+='<line x1="'+x(m.t)+'" x2="'+x(m.t)+'" y1="'+T+'" y2="'+(H-B)+'" stroke="var(--s1)" stroke-dasharray="3 3"/><text x="'+(x(m.t)+3)+'" y="'+(T+8)+'" font-size="11" fill="var(--ink2)">'+esc(m.label)+'</text>';
  s.fights.forEach((f,i)=>{const cx=x(f.t),cy=y(f.won?1-f.hpLeft:1);svg+=f.won?'<circle class="f" data-i="'+i+'" cx="'+cx+'" cy="'+cy+'" r="4.5" fill="var(--ink2)" stroke="var(--surface)" stroke-width="2"/>':'<path class="f" data-i="'+i+'" d="M'+(cx-4.5)+' '+(cy-4.5)+'l9 9m0-9l-9 9" stroke="var(--bad)" stroke-width="2.4" stroke-linecap="round"/>'});
  $('#sample').innerHTML='<p class="meta">'+esc(p.name)+' · semilla '+s.seed+' · '+s.minutes+' min · '+s.days+' días · cada punto es un combate ganado (más alto, más PV le costó); cada ✕, uno perdido; las líneas, un nivel.</p>'+svg+'</svg>';
  $('#sample').querySelectorAll('.f').forEach(c=>{c.addEventListener('mousemove',e=>{const f=s.fights[+c.dataset.i];show(e,'<b>'+esc(DATA.names[f.encounter]??f.encounter)+'</b><br>'+esc(f.stage)+' · min '+Math.round(f.t/60)+(f.day?' · día '+f.day:'')+'<br>'+(f.won?'Ganado con el '+pc(f.hpLeft)+' de PV':'Perdido')+' en '+f.rounds+' rondas')});c.addEventListener('mouseleave',hide)});
}
cards();lines($('#difficulty'),'difficulty','Dificultad a lo largo de la partida');lines($('#trivial'),'trivial','Combates triviales a lo largo de la partida');time();levels();encounters();sample();
`;
export function gamePage(data, names = {}) {
  const page = { ...data, kinds: { walk: 'Andar', read: 'Leer', fight: 'Combatir', scene: 'Escenas', travel: 'Metro y viajes', puzzle: 'Puzles', menu: 'Menús (bote, ánimas)', explore: 'Mirar alrededor' }, names, maxLevel: 3 };
  const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>El juego entero</title><style>${CSS}</style></head>
<body><main>
<h1>El juego entero, sin pantalla</h1>
<p class="meta">${data.runs} partidas · semilla ${data.seed} en adelante · ${esc(new Date(data.made).toLocaleString('es-ES'))} · ${data.seconds} s de simulación · <code>just game-sim</code></p>
<p>Cada partida empieza en «Desde el principio» y sigue la historia real: la misma clase <code>Story</code> que el juego, los lugares con sus cuadrículas, los perseguidores con sus reglas y cada combate jugado por los bots de <code>just fight-sim</code>. El tiempo es una estimación (andar por las cuadrículas, leer cada línea, el reloj de cada combate) para comparar, no una promesa.</p>
<section class="players" id="players"></section>
<h2>La dificultad a lo largo de la partida</h2>
<p>Cada combate, en la décima parte de su partida en que llegó. Dificultad: 100 un combate perdido, si no lo que costó en PV. Trivial: ganado con más del 85 % de PV en tres rondas o menos. El juego se satura cuando todo lo que queda es trivial y no se pierde nada.</p>
<div class="charts"><div class="chart" id="difficulty"></div><div class="chart" id="trivial"></div></div>
<h2>Dónde se va el tiempo</h2><div class="scroll" id="time"></div>
<h2>Las ánimas crecen</h2><p>Cuándo llega cada nivel de las ánimas compartidas, y la EXP que se gana ya en el tope y no sirve de nada.</p><div class="scroll" id="levels"></div>
<h2>Los combates</h2><p>Un muro: se gana a la primera en menos del ${Math.round(.35 * 100)} % de las partidas. «Aprendido»: jugado como quien ya lo entiende, tras perder contra él.</p>
<div class="tabs" id="enc-tabs"></div><div class="scroll" id="encounters"></div>
<h2>Una partida típica</h2><div class="chart" id="sample"></div>
<h2>Lo que el juego aún no tiene</h2><p>Lo que la ruta ha tenido que puentear (se le pone allí, se estima).</p>
<ul class="gaps">${data.gaps.map(g => `<li>${esc(g.text)} <span class="meta">(${g.games} partidas)</span></li>`).join('') || '<li>Nada.</li>'}</ul>
</main><div id="tip"></div>
<script>const DATA=${JSON.stringify(page).replace(/</g, '\\u003c')};${APP}</script></body></html>`;
}
