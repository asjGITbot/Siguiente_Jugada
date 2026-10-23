import {api,header,passwordForm,submitPassword,errorText,roles} from './account-api.js';
import {esc} from './components/ui.js';
const app=document.querySelector('#account-app');let expiry;
async function init(){let user;try{user=await api('/session');}catch{location.replace('/');return;}
  app.innerHTML=header('Mi cuenta')+`<main id="content" class="account-narrow"><div class="account-card"><p class="eyebrow">CUENTA PERSONAL</p><h1>${esc(user.displayName)}</h1><p class="muted">${esc(user.username)} · ${roles[user.role]}</p>${passwordForm(user.mustChangePassword)}<div class="account-actions"><a href="${user.role==='admin'?'/admin/':'/'}">Volver</a><button class="btn ghost" data-exit title="Cierra tu sesión y regresa al inicio; no elimina tu cuenta.">Salir</button></div></div></main>`;
  expiry=setTimeout(()=>location.replace('/'),Math.max(0,user.expiresAt-Date.now()));
  document.querySelector('#password-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),status=form.querySelector('[role=status]');button.disabled=true;status.textContent='Guardando…';try{const result=await submitPassword(form);form.reset();location.replace(result.role==='admin'?'/admin/':'/');}catch(e){status.textContent=errorText(e);status.classList.add('error-box');button.disabled=false;}});
  document.querySelector('[data-exit]').addEventListener('click',async()=>{await api('/logout',{});location.replace('/');});
}
window.addEventListener('pagehide',()=>{clearTimeout(expiry);app.innerHTML='';});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});init();
