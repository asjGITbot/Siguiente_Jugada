import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handle,passwordHash,verifyPassword} from '../api/cloudflare-worker/accounts-worker.js';
import {googleToken} from '../api/cloudflare-worker/worker.js';
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
 assert.notEqual(a,b);
 const iterations=Number(a.split(String.fromCharCode(36))[1]);
 assert.equal(iterations,100000,'Cloudflare Workers cap PBKDF2 to 100000 iterations');
 assert(await verifyPassword('123456789012AAAA',a));assert.equal(await verifyPassword('nope!!',a),false);
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
test('private diagnostics are admin-only and never expose private data',async()=>{
 const r=await handle(req('/api/admin/diagnostics','GET',null,admin),env);
 assert.equal(r.status,200);
 const result=await r.json();
 assert.deepEqual(result,{ok:false,stage:'configuration',code:'SHEETS_URL_MISSING'});
 assert.equal(JSON.stringify(result).includes(env.BOOTSTRAP_TOKEN),false);
 const forbidden=await handle(req('/api/admin/diagnostics','GET',null,player),env);
 assert.equal(forbidden.status,403);
});
test('logout revokes cookie, and CSRF origin is denied',async()=>{
 let r=await handle(req('/api/logout','POST',{},player),env);assert.equal(r.status,200);
 r=await handle(req('/api/session','GET',null,player),env);assert.equal(r.status,401);
 r=await handle(req('/api/login','POST',{username:'admin',password:'123456789012AAAA'},'','https://evil.example'),env);
 assert.equal(r.status,403);
});

test('Google OAuth returns narrow error codes and never exposes credentials',async()=>{
 const now=()=>Date.now();
 await assert.rejects(googleToken({GOOGLE_SERVICE_ACCOUNT_JSON:'not-json'},{now,fetch:()=>{throw Error('Must not fetch');}}),e=>e.message==='GOOGLE_CREDENTIALS_JSON_INVALID');
 await assert.rejects(googleToken({GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',client_email:'test@demo.iam.gserviceaccount.com',private_key:'wrong'})},{now,fetch:()=>{throw Error('Must not fetch');}}),e=>e.message==='GOOGLE_CREDENTIALS_FORMAT_INVALID');
 const key=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const der=Buffer.from(await crypto.subtle.exportKey('pkcs8',key.privateKey));
 const pem='-----BEGIN PRIVATE KEY-----\n'+der.toString('base64')+'\n-----END PRIVATE KEY-----';
 const valid={GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',client_email:'test@demo.iam.gserviceaccount.com',private_key:pem})};
 const invalidGrant={now,fetch:async()=>new Response(JSON.stringify({error:'invalid_grant',error_description:'sensitive provider detail'}),{status:400})};
 await assert.rejects(googleToken(valid,invalidGrant),e=>e.message==='GOOGLE_OAUTH_INVALID_GRANT'&&!e.message.includes('sensitive'));
 const ok=await googleToken(valid,{now,fetch:async()=>new Response(JSON.stringify({access_token:'test-token'}),{status:200})});
 assert.equal(ok,'test-token');
});

test('admin diagnostics separate outbound POST failure from Google egress outage',async()=>{
 const key=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const der=Buffer.from(await crypto.subtle.exportKey('pkcs8',key.privateKey));
 const pem='-----BEGIN PRIVATE KEY-----\n'+der.toString('base64')+'\n-----END PRIVATE KEY-----';
 const diagnosticEnv={
  ...env,
  GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',client_email:'test@demo.iam.gserviceaccount.com',private_key:pem}),
  GOOGLE_SHEETS_URL:'https://docs.google.com/spreadsheets/d/test-doc/edit',
  ALLOWED_SHEETS_JSON:JSON.stringify({'test-doc':{datasetKind:'REAL',range:"'Respuestas de formulario 1'!A:BH"}})
 };
 const partial={fetch:async(url,options)=>{
  if(url==='https://oauth2.googleapis.com/token'&&options?.method==='POST')throw new Error('Sensitive assertion must never be reflected');
  if(url==='https://oauth2.googleapis.com/token')return new Response('',{status:405});
  if(url.startsWith('https://sheets.googleapis.com/'))return new Response('',{status:200});
  throw new Error('unexpected outbound host');
 }};
 const response=await handle(req('/api/admin/diagnostics','GET',null,admin),diagnosticEnv,partial);
 assert.equal(response.status,200);
 const diagnostics=await response.json();
 assert.deepEqual(diagnostics,{ok:false,stage:'network',code:'GOOGLE_OAUTH_POST_TRANSPORT_ERROR'});
 assert.equal(JSON.stringify(diagnostics).includes('Sensitive assertion'),false);
 const closed=await handle(req('/api/admin/diagnostics','GET',null,admin),diagnosticEnv,{fetch:async()=>{throw new Error('No routes');}});
 assert.deepEqual(await closed.json(),{ok:false,stage:'network',code:'GOOGLE_EGRESS_UNREACHABLE'});
});

test('production Cloudflare fetch keeps the global receiver for Google OAuth and Sheets',async()=>{
 // Simulates workerd's stricter receiver validation that Node's fetch does not enforce.
 const originalFetch=globalThis.fetch;
 const key=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const der=Buffer.from(await crypto.subtle.exportKey('pkcs8',key.privateKey));
 const pem='-----BEGIN PRIVATE KEY-----\n'+der.toString('base64')+'\n-----END PRIVATE KEY-----';
 const sourceId='fake-v04-sheet';
 const schema=JSON.parse(readFileSync(new URL('../config/form-v04.schema.json',import.meta.url),'utf8'));
 const headers=schema.fields.map(f=>f.header);
 const liveEnv={
  ...env,
  GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',client_email:'test@demo.iam.gserviceaccount.com',private_key:pem}),
  GOOGLE_SHEETS_URL:'https://docs.google.com/spreadsheets/d/'+sourceId+'/edit',
  ALLOWED_SHEETS_JSON:JSON.stringify({[sourceId]:{datasetKind:'REAL',range:"'Respuestas de formulario 1'!A:BH"}})
 };
 let oauth=0,sheets=0;
 globalThis.fetch=async function(url,options){
  assert.equal(this,globalThis,'workerd rejects global fetch called as an object method');
  if(url==='https://oauth2.googleapis.com/token'){
   assert.equal(options?.method,'POST');oauth++;
   return new Response(JSON.stringify({access_token:'fake-oauth-token'}),{status:200});
  }
  if(String(url).startsWith('https://sheets.googleapis.com/v4/spreadsheets/')){
   assert.equal(options?.headers?.Authorization,'Bearer fake-oauth-token');sheets++;
   return new Response(JSON.stringify({values:[headers]}),{status:200});
  }
  throw new Error('Unexpected external hostname');
 };
 try{
  const response=await handle(req('/api/admin/diagnostics','GET',null,admin),liveEnv);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true,stage:'complete',code:'GOOGLE_SHEETS_READY'});
  assert.equal(oauth,1);assert.equal(sheets,1);
 }finally{
  globalThis.fetch=originalFetch;
 }
});
