import {authenticate,endSession} from './auth.js';
import {fetchData,SessionStore} from './data-loader.js';
import {normalizeDataset,fieldValue} from './data-normalizer.js';
import {filterRows} from './metrics-engine.js';
import {adventure} from './gamification-engine.js';
import {missionHistory} from './missions-engine.js';
import {selectMessage} from './messages-engine.js';
import {renderCharts,clearCharts} from './chart-engine.js';
import {createRouter} from './router.js';
import * as views from './screens/views.js';
import {esc,icon,button,dateLabel,display} from './components/ui.js';
import {messages as accountErrors} from './account-api.js';

const app=document.querySelector('#app'),dialog=document.querySelector('#detail');
let c,store,router,state=null,expiry=null,dialogState=null;
const errors={EXTERNAL_SETUP_REQUIRED:'Acceso familiar pendiente de configurar. Un adulto debe conectar la API privada y autorizar la hoja. La demo está disponible por separado.',AUTH_REQUIRED:'Primero inicia sesión en el acceso familiar seguro configurado por un adulto.',ACCESS_DENIED:'Esta cuenta no tiene permiso. Pide a un adulto que revise el acceso.',SHEET_NOT_AUTHORIZED:'La hoja seleccionada no está autorizada para esta cuenta. Pide a un adulto que revise sus permisos.',SOURCE_UNAVAILABLE:'No pudimos leer la fuente. Revisa la conexión y vuelve a intentarlo cuando esté disponible.',SESSION_EXPIRED:'Tu sesión terminó. Vuelve a entrar para cargar tus respuestas.',SCHEMA_COLUMNS:'La hoja no coincide con las 60 columnas del V04. Un adulto debe revisar el encabezado.',SCHEMA_HEADERS:'No pudimos reconocer los encabezados del V04. La fuente necesita revisión.',ROW_COLUMNS:'Una fila no conserva el contrato V04. Pide a un adulto que revise la fuente.',FIELD_PERMISSION_VIOLATION:'La respuesta no cumple los permisos de esta sesión. No se mostrarán datos.',MIXED_SOURCE:'El tipo de fuente no coincide con esta sesión. No se mostrarán datos.',DATA_CONTRACT:'La fuente no devolvió el contrato esperado. Pide a un adulto que la revise.'};
async function json(path,signal){const response=await fetch(path,{cache:'no-store',signal});if(!response.ok)throw new Error('CONFIG_UNAVAILABLE');return response.json();}

async function init(){
  const names={schema:'form-v04.schema',charts:'charts',game:'gamification',missions:'mission-rules',messages:'messages',ui:'ui',assets:'assets-manifest'};
  c=Object.fromEntries(await Promise.all(Object.entries(names).map(async([key,name])=>[key,await json(`config/${name}.json`)])));
  store=new SessionStore({config:signal=>json('public/config/data-source.json',signal),auth:authenticate,fetch:(config,session,signal)=>fetchData(config,session,signal,c.schema),normalize:payload=>normalizeDataset(payload,c.schema),status:text=>{const e=document.querySelector('#login-status');if(e)e.textContent=text+'…';}});
  router=createRouter(c.ui.screens.map(s=>s.id),page=>{state.screen=page;render();document.querySelector('h1')?.focus({preventScroll:true});window.scrollTo(0,0);});
  showLogin();
  if('serviceWorker' in navigator && (location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){navigator.serviceWorker.register('service-worker.js').then(()=>navigator.serviceWorker.ready).then(async()=>{
    const cachesForApp=(await caches.keys()).filter(key=>(key.startsWith('ssr11-shell-')||key.startsWith('siguiente-jugada-shell-')));
    const paths=(await Promise.all(cachesForApp.map(async key=>(await (await caches.open(key)).keys()).map(r=>new URL(r.url).pathname)))).flat();
    const clean=paths.every(path=>!path.includes('/__test/')&&!path.endsWith('/data')&&!path.includes('/fixtures/')&&!path.endsWith('.xlsx')&&!path.endsWith('/data-source.json'));
    document.body.dataset.pwa=clean?'ready-public-shell':'cache-audit-failed';
    document.body.dataset.pwaCacheItems=String(paths.length);
  }).catch(()=>{document.body.dataset.pwa='unavailable';});}
}
function showLogin(message=''){app.innerHTML=views.login(c);if(message){const p=document.querySelector('#login-status');p.textContent=message;p.classList.add('error-box');}}
async function login(mode){
  const role=mode==='account'?Object.fromEntries(new FormData(document.querySelector('#account-login'))):document.querySelector('#demo-role')?.value||'player';document.querySelectorAll('[data-login],#account-login button').forEach(b=>b.disabled=true);
  try{
    const loaded=await store.login(mode,role);
    state={...loaded,screen:'aventura',filters:{values:{},count:null,from:'',to:''},learningTab:'practice',observer:'',game:adventure(loaded.data.rows,c.game),missions:missionHistory(loaded.data.rows,c.missions)};
    router.reset();render();
    const ttl=loaded.session.expiresAt-Date.now();if(ttl<=0){logout(errors.SESSION_EXPIRED);return;}
    clearTimeout(expiry);expiry=setTimeout(()=>logout(errors.SESSION_EXPIRED),Math.min(ttl,2147483647));
  }catch(e){if(e.name==='AbortError')return;if(e.message==='PASSWORD_ROUTE'){location.assign('/account/');return;}if(e.message==='ADMIN_ROUTE'){location.assign('/admin/');return;}showLogin(accountErrors[e.message]||errors[e.message]||'No se pudo completar el ingreso. Revisa tu conexión e inténtalo de nuevo.');}
}
function render(){
  if(!state)return;clearCharts();
  state.rows=filterRows(state.data.rows,state.filters);state.message=selectMessage(state.rows,c.messages);
  const fn={aventura:views.overview,emociones:views.emotions,protagonista:views.protagonist,reinicio:views.reset,aprendizajes:views.learn,espejo:views.mirror}[state.screen];
  app.innerHTML=views.frame(c,state,fn(c,state));
  document.querySelector('h1').tabIndex=-1;
  const chartRows=state.screen==='espejo'&&state.observer?state.rows.filter(r=>fieldValue(r,'q50')===state.observer):state.rows;
  renderCharts(app,chartRows,c.schema,c.charts,c.ui,state.config);
}
async function logout(message=''){
  clearTimeout(expiry);expiry=null;const old=store.logout();clearCharts();dialog.close();dialog.innerHTML='';dialogState=null;state=null;router.reset();app.innerHTML='<main class="boot"><p>Cerrando sesión…</p></main>';await endSession(old?.session);showLogin(message);
}
function openDialog(title,body){dialog.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2>${button(icon('close'),'data-close','ghost','Cierra este detalle. No modifica tus respuestas.')}</div>${body}`;if(!dialog.open)dialog.showModal();}
function answers({match,field:fieldId,section}={}){
  if(!state)return;
  const f=c.schema.fields.find(f=>f.id===fieldId),row=state.data.rows.find(r=>r.id===match)||state.rows.at(-1)||state.data.rows.at(-1);
  if(!row){openDialog('Mis respuestas',`<p>${c.ui.texts.noData}</p>`);return;}
  dialogState={match:row.id,field:fieldId,section:section||f?.section||c.schema.sections.find(x=>x.screen===state.screen)?.id||'partido'};
  drawAnswers();
}
function drawAnswers(){
  const d=dialogState,row=state.data.rows.find(r=>r.id===d.match);
  const visible=c.schema.fields.filter(f=>f.section===d.section&&row.fields[f.id]&&f.roles.includes(state.session.role));
  const fields=d.field?visible.filter(f=>f.id===d.field):visible;
  openDialog('Ver mis respuestas',`<p class="small muted">${esc(c.ui.texts.timestampNote)}</p><div class="dialog-filters"><label>Partido<select data-answer-match>${state.data.rows.slice().reverse().map(r=>`<option value="${esc(r.id)}" ${r.id===row.id?'selected':''}>${dateLabel(r.timestamp,state.config,true)} · ${esc(fieldValue(r,'q2'))} / ${esc(fieldValue(r,'q7'))}</option>`).join('')}</select></label><label>Sección<select data-answer-section>${c.schema.sections.map(s=>`<option value="${s.id}" ${s.id===d.section?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label></div>${d.field?button('Ver toda esta sección','data-all-section','ghost','Muestra todas las preguntas permitidas de esta sección. Solo lectura.'):''}<div>${fields.map(f=>{const v=row.fields[f.id];return `<article class="answer ${v.status==='INVALID'?'invalid':''}"><div class="answer-head"><h3>${esc(f.questionId.toUpperCase())}${f.id.includes('.')?' · '+esc(f.shortTitle):''} · ${esc(f.header)}</h3><span class="chip">${esc(c.ui.statusLabels[v.status])}</span></div><p>${esc(v.status==='VALID'?display(v.value):c.ui.statusLabels[v.status])}</p>${v.raw!=null&&v.status!=='VALID'?`<small>Valor original conservado: ${esc(display(v.raw))}</small>`:''}</article>`;}).join('')||'<p class="empty">Este campo no está disponible para tu sesión.</p>'}</div>`);
}
function badge(id){const b=state.game.badges.find(b=>b.id===id);openDialog(b.name,`<p>${b.earned?'Ganada con evidencia':'Por descubrir'} · ${b.count} registros / objetivo ${b.goal}</p><p class="small muted">Regla ${esc(b.id)} · ${esc(c.ui.texts.fullAdventure)}</p><ul class="evidence-list">${b.evidence.map(id=>{const r=state.data.rows.find(r=>r.id===id);return `<li>${button(dateLabel(r.timestamp,state.config)+' · Ver evidencia',`data-match="${esc(id)}"`,'ghost','Muestra el partido que sustenta esta insignia. Solo lectura.')}</li>`;}).join('')}</ul><p class="small muted">Las insignias reconocen reflexión y práctica. No comparan jugadores.</p>`);}
function xp(){openDialog('Mis XP, paso a paso',`<p>${esc(c.game.disclaimer)}</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Envío</th><th>Regla</th><th>XP</th><th>Evidencia</th></tr></thead><tbody>${state.game.events.map(event=>{const row=state.data.rows.find(r=>r.id===event.rowId);return `<tr><td>${dateLabel(row.timestamp,state.config)}</td><td>${esc(event.label)}<br><small>${esc(event.rule_id)}</small></td><td>+${event.xp}</td><td>${button('Ver',`data-match="${esc(row.id)}"`,'ghost','Consulta las respuestas que originaron este evento XP. Solo lectura.')}</td></tr>`;}).join('')}</tbody></table></div>`);}
document.addEventListener('submit',event=>{if(event.target.id==='account-login'){event.preventDefault();login('account');}});
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.login)return login(b.dataset.login);
  if(b.hasAttribute('data-logout'))return logout();
  if(b.hasAttribute('data-close'))return dialog.close();
  if(!state)return;
  if(b.dataset.page)return router.go(b.dataset.page);
  if(b.hasAttribute('data-open-missions')){state.learningTab='missions';return router.go('aprendizajes');}
  if(b.dataset.learningTab){state.learningTab=b.dataset.learningTab;return render();}
  if(b.hasAttribute('data-answers'))return answers();
  if(b.dataset.answersField)return answers({field:b.dataset.answersField});
  if(b.dataset.match)return answers({match:b.dataset.match});
  if(b.dataset.badge)return badge(b.dataset.badge);
  if(b.hasAttribute('data-xp'))return xp();
  if(b.hasAttribute('data-all-section')){dialogState.field=null;return drawAnswers();}
});
document.addEventListener('change',event=>{
  const e=event.target;if(!state)return;
  if(e.dataset.filter){state.filters.values[e.dataset.filter]=e.value;render();}
  else if(e.hasAttribute('data-count')){state.filters.count=e.value?Number(e.value):null;render();}
  else if(e.dataset.date){state.filters[e.dataset.date]=e.value;render();}
  else if(e.hasAttribute('data-observer')){state.observer=e.value;render();}
  else if(e.hasAttribute('data-answer-match')){dialogState.match=e.value;drawAnswers();}
  else if(e.hasAttribute('data-answer-section')){dialogState.section=e.value;dialogState.field=null;drawAnswers();}
});
window.addEventListener('pagehide',()=>{if(store){store.logout();clearCharts();state=null;dialogState=null;dialog.innerHTML='';app.innerHTML='';}});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.addEventListener('offline',()=>{if(state){const notice=app.querySelector('.notice');notice.textContent='Sin conexión · ves la lectura de esta sesión, no datos nuevos.';}});
init().catch(()=>{app.innerHTML='<main class="boot"><p>No se pudo cargar la interfaz. Comprueba la conexión con el sitio.</p></main>';});
