import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handle,passwordHash,verifyPassword} from '../api/cloudflare-worker/accounts-worker.js';
class FakeD1{
 constructor(){
  this.db=new DatabaseSync(':memory:');
  this.db.exec(readFileSync(new URL('../api/cloudflare-worker/migrations/0001_accounts.sql',import.meta.url),'utf8'));
 }
 prepare(sql){
  const s=this.db.prepare(sql);
  return {bind:(...v)=>({first:async()=>s.get(...v)||null,all:async()=>({results:s.all(...v)}),run:async()=>({meta:s.run(...v)})})};
 }
}
const env={DB:new FakeD1(),PLAYERS_JSON:'["Jugador de prueba"]',BOOTSTRAP_TOKEN:'test_secret_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',ALLOWED_SHEETS_JSON:'{}'};
const req=(path,method='GET',body=null,cookie='',origin='https://app.example')=>new Request('https://app.example'+path,{method,headers:{...(method!=='GET'?{'Content-Type':'application/json','Origin':origin,'X-SSR11-Request':'1'}:{}),...(cookie?{Cookie:'__Host-sj_session='+cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
const getCookie=r=>r.headers.get('Set-Cookie')?.match(/__Host-sj_session=([^;]+)/)?.[1];
let admin,player;
test('PBKDF2 has random salt and rejects wrong passwords',async()=>{
 const a=await passwordHash('123456789012AAAA'),b=await passwordHash('123456789012AAAA');
 assert.notEqual(a,b);assert(await verifyPassword('123456789012AAAA',a));assert.equal(await verifyPassword('nope!!',a),false);
});
test('bootstrap token cannot be guessed; first admin only once',async()=>{
 let r=await handle(req('/api/setup','POST',{setupToken:'bad',username:'admin',displayName:'Admin',password:'123456789012AAAA'}),env);
 assert.equal(r.status,403);
 r=await handle(req('/api/setup','POST',{setupToken:env.BOOTSTRAP_TOKEN,username:'admin',displayName:'Admin',password:'123456789012AAAA'}),env);
 assert.equal(r.status,200);admin=getCookie(r);assert(admin);assert.match(r.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Strict/);
 r=await handle(req('/api/setup','POST',{setupToken:env.BOOTSTRAP_TOKEN,username:'other',displayName:'Other',password:'123456789012AAAA'}),env);
 assert.equal(r.status,403);
});
test('admin provisions viewer; child cannot have confidential P54',async()=>{
 const invalid={username:'child',displayName:'Test',role:'player',players:['Jugador de prueba'],password:'123456789012AAAA',canReadP54:true};
 let r=await handle(req('/api/admin/users','POST',invalid,admin),env);assert.equal(r.status,400);
 r=await handle(req('/api/admin/users','POST',{...invalid,canReadP54:false},admin),env);assert.equal(r.status,201);
 r=await handle(req('/api/admin/users','GET',null,admin),env);assert.equal(r.status,200);assert.equal((await r.json()).users.length,2);
});
test('temporary password rotated before any Sheets reading',async()=>{
 let r=await handle(req('/api/login','POST',{username:'child',password:'123456789012AAAA'}),env);assert.equal(r.status,200);
 player=getCookie(r);assert.equal((await r.json()).mustChangePassword,true);
 r=await handle(req('/api/data','POST',{googleSheetsUrl:'untrusted'},player),env);assert.equal(r.status,403);
 r=await handle(req('/api/password','POST',{currentPassword:'123456789012AAAA',password:'DIFFERENT_secret_321_xyz'},player),env);
 assert.equal(r.status,200);player=getCookie(r);assert.equal((await r.json()).mustChangePassword,false);
 r=await handle(req('/api/data','POST',{googleSheetsUrl:'https://docs.google.com/spreadsheets/d/NO_PERMISSION/edit'},player),env);
 assert.equal(r.status,403);assert.equal((await r.json()).code,'SHEET_NOT_AUTHORIZED');
});
test('logout revokes cookie, and CSRF origin is denied',async()=>{
 let r=await handle(req('/api/logout','POST',{},player),env);assert.equal(r.status,200);
 r=await handle(req('/api/session','GET',null,player),env);assert.equal(r.status,401);
 r=await handle(req('/api/login','POST',{username:'admin',password:'123456789012AAAA'},'','https://evil.example'),env);
 assert.equal(r.status,403);
});
