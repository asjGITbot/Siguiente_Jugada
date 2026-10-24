import {authorizeRows,googleToken,sheetIdFromUrl} from './worker.js';
// Cloudflare Workers WebCrypto PBKDF2 deriveBits rejects iteration counts over 100000.
// Keep the encoded count in each password hash for deterministic verification.
const COOKIE='__Host-sj_session',TTL=3600,ITERATIONS=100000,enc=new TextEncoder();
const roles=new Set(['admin','player','parent','psychologist']),adults=new Set(['parent','psychologist']);
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
function fail(code,status=400){const e=new Error(code);e.status=status;throw e;}
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
const hash=async text=>crypto.subtle.digest('SHA-256',enc.encode(text));
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
const ct=(a,b)=>{const x=new Uint8Array(a),y=new Uint8Array(b);if(x.length!==y.length)return false;let v=0;for(let i=0;i<x.length;i++)v|=x[i]^y[i];return v===0;};
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
function publicUser(u,expiresAt=0){return {id:u.id,username:u.username,displayName:u.display_name,role:u.role,players:JSON.parse(u.players_json),canReadP54:adults.has(u.role)&&u.can_p54===1,active:u.active===1,mustChangePassword:u.must_change===1,expiresAt};}
function validateUsername(s){if(typeof s!=='string'||s.length<3||s.length>80||!/^[a-z0-9_.@-]+$/i.test(s))fail('USERNAME_INVALID');return s.toLowerCase();}
function validateName(s){if(typeof s!=='string'||!s.trim()||s.length>80)fail('NAME_INVALID');return s.trim();}
export async function passwordHash(password,salt=crypto.getRandomValues(new Uint8Array(16))){
 if(typeof password!=='string'||password.length<12||password.length>128)fail('PASSWORD_LENGTH');
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const value=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},key,256);
 return ['pbkdf2-sha256',ITERATIONS,b64(salt),b64(value)].join('$');
}
export async function verifyPassword(password,stored){
 if(typeof password!=='string'||password.length>128||!stored?.startsWith('pbkdf2-sha256$'))return false;
 const parts=stored.split('$');if(Number(parts[1])!==ITERATIONS)return false;
 try{return ct(unb64((await passwordHash(password,unb64(parts[2]))).split('$')[3]),unb64(parts[3]));}catch{return false;}
}
const setCookie=(token,clear=false)=>COOKIE+'='+(clear?'':token)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+(clear?0:TTL);
async function newSession(db,u){
 const token=b64(crypto.getRandomValues(new Uint8Array(32))),expires=Date.now()+TTL*1000;
 await q(db,'INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)',b64(await hash(token)),u.id,expires).run();
 return {body:publicUser(u,expires),cookie:setCookie(token)};
}
async function session(request,env,opts={}){
 const token=(request.headers.get('Cookie')||'').split(/;\s*/).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!token||!/^[-_A-Za-z0-9]{40,60}$/.test(token))fail('SESSION_EXPIRED',401);
 const key=b64(await hash(token));
 const user=await q(env.DB,'SELECT u.*,s.expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1',key,Date.now()).first();
 if(!user)fail('SESSION_EXPIRED',401);
 if(user.must_change&&!opts.allowChange)fail('PASSWORD_CHANGE_REQUIRED',403);
 if(opts.admin&&user.role!=='admin')fail('ADMIN_REQUIRED',403);
 return {user,key,expires:user.expires};
}
async function body(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail('JSON_REQUIRED',415);
 const raw=await request.text();if(raw.length>16384)fail('BAD_REQUEST',413);
 try{const x=JSON.parse(raw);if(!x||Array.isArray(x)||typeof x!=='object')fail('BAD_REQUEST');return x;}catch{fail('BAD_REQUEST');}
}
function permitted(env,values,role){
 let list;try{list=JSON.parse(env.PLAYERS_JSON||'[]');}catch{fail('EXTERNAL_SETUP_REQUIRED',503);}
 if(!Array.isArray(list)||list.some(x=>typeof x!=='string'))fail('EXTERNAL_SETUP_REQUIRED',503);
 if(role==='admin')return [];
 if(!Array.isArray(values)||!values.length)fail('PLAYERS_REQUIRED');
 if(values.some(x=>!list.some(p=>norm(p)===norm(x))))fail('PLAYERS_INVALID');
 return [...new Set(values.map(x=>list.find(p=>norm(p)===norm(x))))];
}
function validateUser(env,input,editing=false,self=false,old={}){
 const username=validateUsername(input.username),displayName=validateName(input.displayName),role=self?'admin':input.role;
 if(!roles.has(role))fail('ROLE_INVALID');
 if(self&&(username!==old.username||input.active===false||(input.role&&input.role!=='admin')))fail('SELF_ADMIN_PROTECTED',409);
 const players=permitted(env,input.players,role),active=self?true:input.active!==false,canP54=adults.has(role)&&input.canReadP54===true;
 if(input.canReadP54===true&&!adults.has(role))fail('P54_ADULT_ONLY');
 if(!editing&&(!input.password||input.password.length<12))fail('PASSWORD_LENGTH');
 return {username,displayName,role,players,active,canP54};
}
async function audit(db,actor,action,target){await q(db,'INSERT INTO audit(at,actor,action,target) VALUES(?,?,?,?)',Date.now(),actor,action,target).run();}
async function throttle(db,key){
 const now=Date.now();await q(db,'DELETE FROM attempts WHERE at<?',now-900000).run();
 const n=await q(db,'SELECT count(*) AS n FROM attempts WHERE key=? AND at>?',key,now-900000).first();
 if(n.n>=6)fail('TOO_MANY_ATTEMPTS',429);
}
async function setup(env,input){
 if(typeof env.BOOTSTRAP_TOKEN!=='string'||env.BOOTSTRAP_TOKEN.length<32)fail('EXTERNAL_SETUP_REQUIRED',503);
 if(typeof input.setupToken!=='string'||!ct(await hash(input.setupToken),await hash(env.BOOTSTRAP_TOKEN)))fail('SETUP_DENIED',403);
 const username=validateUsername(input.username),displayName=validateName(input.displayName),password=await passwordHash(input.password),id=crypto.randomUUID();
 const r=await q(env.DB,"INSERT INTO users(id,username,display_name,password_hash,role,players_json,can_p54,active,must_change,created_at) SELECT ?,?,?,?,'admin','[]',0,1,0,? WHERE NOT EXISTS (SELECT 1 FROM users)",id,username,displayName,password,Date.now()).run();
 if(r.meta.changes!==1)fail('SETUP_DENIED',403);
 await audit(env.DB,id,'admin.setup',id);
 return newSession(env.DB,await q(env.DB,'SELECT * FROM users WHERE id=?',id).first());
}
async function login(request,env,input){
 const username=String(input.username||'').toLowerCase(),ip=request.headers.get('CF-Connecting-IP')||'unknown',key='login:'+ip+':'+username.slice(0,80);
 await throttle(env.DB,key);
 const user=await q(env.DB,'SELECT * FROM users WHERE username=? AND active=1',username).first();
 if(!user||!await verifyPassword(input.password,user.password_hash)){
  await q(env.DB,'INSERT INTO attempts(key,at) VALUES(?,?)',key,Date.now()).run();
  fail('INVALID_CREDENTIALS',401);
 }
 await q(env.DB,'DELETE FROM attempts WHERE key=?',key).run();
 await audit(env.DB,user.id,'user.login',user.id);
 return newSession(env.DB,user);
}
async function changePassword(env,s,input){
 if(!await verifyPassword(input.currentPassword,s.user.password_hash))fail('INVALID_CREDENTIALS',401);
 if(input.password===input.currentPassword)fail('PASSWORD_MUST_DIFFER');
 const password=await passwordHash(input.password);
 await q(env.DB,'UPDATE users SET password_hash=?,must_change=0 WHERE id=?',password,s.user.id).run();
 await q(env.DB,'DELETE FROM sessions WHERE user_id=?',s.user.id).run();
 await audit(env.DB,s.user.id,'password.change',s.user.id);
 return newSession(env.DB,{...s.user,password_hash:password,must_change:0});
}
async function createUser(env,s,input){
 const x=validateUser(env,input),password=await passwordHash(input.password),id=crypto.randomUUID();
 try{await q(env.DB,'INSERT INTO users(id,username,display_name,password_hash,role,players_json,can_p54,active,must_change,created_at) VALUES(?,?,?,?,?,?,?,?,1,?)',id,x.username,x.displayName,password,x.role,JSON.stringify(x.players),Number(x.canP54),Number(x.active),Date.now()).run();}
 catch(e){if(String(e).includes('UNIQUE'))fail('USERNAME_EXISTS',409);throw e;}
 await audit(env.DB,s.user.id,'user.create',id);
 return publicUser(await q(env.DB,'SELECT * FROM users WHERE id=?',id).first());
}
async function updateUser(env,s,id,input){
 const old=await q(env.DB,'SELECT * FROM users WHERE id=?',id).first();if(!old)fail('NOT_FOUND',404);
 const x=validateUser(env,input,true,id===s.user.id,old);
 if(old.role==='admin'&&old.active===1&&(!x.active||x.role!=='admin')){
  const n=await q(env.DB,"SELECT count(*) AS n FROM users WHERE role='admin' AND active=1").first();
  if(n.n<=1)fail('LAST_ADMIN',409);
 }
 let password=old.password_hash,must=old.must_change;
 if(input.password){password=await passwordHash(input.password);must=1;}
 try{await q(env.DB,'UPDATE users SET username=?,display_name=?,role=?,players_json=?,can_p54=?,active=?,password_hash=?,must_change=? WHERE id=?',x.username,x.displayName,x.role,JSON.stringify(x.players),Number(x.canP54),Number(x.active),password,must,id).run();}
 catch(e){if(String(e).includes('UNIQUE'))fail('USERNAME_EXISTS',409);throw e;}
 await q(env.DB,'DELETE FROM sessions WHERE user_id=?',id).run();
 await audit(env.DB,s.user.id,'user.update',id);
 return publicUser(await q(env.DB,'SELECT * FROM users WHERE id=?',id).first());
}
async function readData(env,s,input,io){
 if(s.user.role==='admin')fail('VIEWER_ACCOUNT_REQUIRED',403);
 const id=sheetIdFromUrl(env.GOOGLE_SHEETS_URL||input.googleSheetsUrl);
 let sheets;try{sheets=JSON.parse(env.ALLOWED_SHEETS_JSON||'{}');}catch{fail('EXTERNAL_SETUP_REQUIRED',503);}
 const sheet=sheets[id];
 if(!sheet||!['REAL','DEMO'].includes(sheet.datasetKind))fail('SHEET_NOT_AUTHORIZED',403);
 if(typeof sheet.range!=='string'||!sheet.range.endsWith('!A:BH')||sheet.range.length>150)fail('EXTERNAL_SETUP_REQUIRED',503);
 const token=await googleToken(env,{...io,now:()=>Date.now()});
 const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values/'+encodeURIComponent(sheet.range)+'?valueRenderOption=FORMATTED_VALUE';
 const r=await io.fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
 if(!r.ok)fail(r.status===403?'SHEET_NOT_AUTHORIZED':'SOURCE_UNAVAILABLE',r.status===403?403:502);
 const user={role:s.user.role,players:JSON.parse(s.user.players_json),canReadP54:adults.has(s.user.role)&&s.user.can_p54===1};
 const data=authorizeRows((await r.json()).values,user,sheet.datasetKind);
 await q(env.DB,'UPDATE sessions SET data_reads=data_reads+1 WHERE token_hash=?',s.key).run();
 return data;
}

async function checkGoogleSheetsConnection(env,io){
 // Admin-only, read-only; never expose identities, spreadsheet ids, rows, tokens or provider error bodies.
 const failCheck=(stage,code)=>({ok:false,stage,code});
 if(!env.GOOGLE_SHEETS_URL)return failCheck('configuration','SHEETS_URL_MISSING');
 let id;
 try{id=sheetIdFromUrl(env.GOOGLE_SHEETS_URL);}catch{return failCheck('configuration','SHEETS_URL_INVALID');}
 let sheets;
 try{sheets=JSON.parse(env.ALLOWED_SHEETS_JSON||'{}');}catch{return failCheck('configuration','ALLOWED_SHEETS_JSON_INVALID');}
 if(!sheets||typeof sheets!=='object'||Array.isArray(sheets))return failCheck('configuration','ALLOWED_SHEETS_JSON_INVALID');
 const sheet=sheets[id];
 if(!sheet||!['REAL','DEMO'].includes(sheet.datasetKind))return failCheck('configuration','SHEET_NOT_AUTHORIZED');
 if(typeof sheet.range!=='string'||!sheet.range.endsWith('!A:BH')||sheet.range.length>150)return failCheck('configuration','SHEET_RANGE_INVALID');
 if(!env.GOOGLE_SERVICE_ACCOUNT_JSON)return failCheck('credentials','SERVICE_ACCOUNT_MISSING');
 let account;
 try{account=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);}catch{return failCheck('credentials','SERVICE_ACCOUNT_JSON_INVALID');}
 if(typeof account?.client_email!=='string'||typeof account?.private_key!=='string')return failCheck('credentials','SERVICE_ACCOUNT_JSON_INVALID');
 let token;
 try{token=await googleToken(env,{...io,now:()=>Date.now()});}
 catch(e){
  const credentialCodes=new Set(['GOOGLE_CREDENTIALS_MISSING','GOOGLE_CREDENTIALS_JSON_INVALID','GOOGLE_CREDENTIALS_FORMAT_INVALID','GOOGLE_PRIVATE_KEY_INVALID','GOOGLE_JWT_SIGN_FAILED']);
  const oauthCodes=new Set(['GOOGLE_OAUTH_NETWORK_FAILED','GOOGLE_OAUTH_INVALID_GRANT','GOOGLE_OAUTH_INVALID_CLIENT','GOOGLE_OAUTH_UNAUTHORIZED_CLIENT','GOOGLE_OAUTH_INVALID_SCOPE','GOOGLE_OAUTH_INVALID_REQUEST','GOOGLE_OAUTH_HTTP_FAILED','GOOGLE_OAUTH_RESPONSE_INVALID','GOOGLE_OAUTH_NO_ACCESS_TOKEN']);
  const code=credentialCodes.has(e.message)||oauthCodes.has(e.message)?e.message:'GOOGLE_AUTH_UNEXPECTED_ERROR';
  if(code==='GOOGLE_OAUTH_NETWORK_FAILED'){
   // Probe only public, fixed Google endpoints. No authorization, tokens, JWTs or row data sent.
   const probe=async url=>{
    try{const r=await io.fetch(url,{method:'GET',cache:'no-store'});return Number.isInteger(r.status)&&r.status>0;}
    catch{return false;}
   };
   const tokenReachable=await probe('https://oauth2.googleapis.com/token');
   const sheetsReachable=await probe('https://sheets.googleapis.com/$discovery/rest?version=v4');
   const category=!tokenReachable&&!sheetsReachable?'GOOGLE_EGRESS_UNREACHABLE':
    !tokenReachable?'GOOGLE_OAUTH_HOST_UNREACHABLE':
    !sheetsReachable?'GOOGLE_OAUTH_POST_TRANSPORT_ERROR':'GOOGLE_OAUTH_POST_TRANSPORT_ERROR';
   return failCheck('network',category);
  }
  return failCheck(credentialCodes.has(code)?'credentials':'oauth',code);
 }
 let response;
 try{
  const range=sheet.range.replace('!A:BH','!A1:BH1');
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE';
  response=await io.fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
 }catch{return failCheck('sheets','GOOGLE_SHEETS_NETWORK_ERROR');}
 if(!response.ok)return failCheck('sheets',response.status===403?'GOOGLE_SHEETS_FORBIDDEN':response.status===404?'GOOGLE_SHEETS_NOT_FOUND':'GOOGLE_SHEETS_HTTP_ERROR');
 let values;
 try{values=(await response.json()).values;}catch{return failCheck('schema','GOOGLE_SHEETS_RESPONSE_INVALID');}
 try{authorizeRows(values,{role:'player',players:['__diagnostic__'],canReadP54:false},sheet.datasetKind);}
 catch{return failCheck('schema','V04_HEADERS_MISMATCH');}
 return {ok:true,stage:'complete',code:'GOOGLE_SHEETS_READY'};
}

const publicErrors=new Set(['SESSION_EXPIRED','PASSWORD_CHANGE_REQUIRED','INVALID_CREDENTIALS','ADMIN_REQUIRED','USERNAME_EXISTS','USERNAME_INVALID','NAME_INVALID','PASSWORD_LENGTH','PASSWORD_MUST_DIFFER','PLAYERS_REQUIRED','PLAYERS_INVALID','ROLE_INVALID','P54_ADULT_ONLY','SELF_ADMIN_PROTECTED','LAST_ADMIN','SETUP_DENIED','TOO_MANY_ATTEMPTS','EXTERNAL_SETUP_REQUIRED','SHEET_NOT_AUTHORIZED','SOURCE_UNAVAILABLE','SCHEMA_HEADERS','ROW_COLUMNS','JSON_REQUIRED','BAD_REQUEST','NOT_FOUND','VIEWER_ACCOUNT_REQUIRED','ORIGIN_DENIED','HTTPS_REQUIRED']);
export async function handle(request,env,io={fetch:(...args)=>globalThis.fetch(...args)}){
 const path=new URL(request.url).pathname,origin=new URL(request.url).origin;
 const respond=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
 if(!path.startsWith('/api/')){
  if(!env.ASSETS)return respond({code:'ASSETS_NOT_CONFIGURED'},503);
  const response=await env.ASSETS.fetch(request),h=new Headers(response.headers);
  h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');
  h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  if(path==='/public/config/data-source.json')h.set('Cache-Control','no-store');
  return new Response(response.body,{status:response.status,headers:h});
 }
 try{
  if(!env.DB)fail('EXTERNAL_SETUP_REQUIRED',503);
  if(new URL(request.url).protocol!=='https:')fail('HTTPS_REQUIRED',400);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==origin)fail('ORIGIN_DENIED',403);
  if(['POST','PATCH','PUT','DELETE'].includes(request.method)&&(request.headers.get('Origin')!==origin||request.headers.get('X-SSR11-Request')!=='1'))fail('ORIGIN_DENIED',403);
  if(path==='/api/status'&&request.method==='GET'){
   const n=await q(env.DB,'SELECT count(*) AS n FROM users').first();
   return respond({app:'Siguiente Jugada',version:'3.0-cloudflare-d1',setupRequired:n.n===0,authentication:'accounts',dataMode:'GOOGLE_SHEETS'});
  }
  if(path==='/api/setup'&&request.method==='POST'){
   const n=await q(env.DB,'SELECT count(*) AS n FROM users').first();
   if(n.n!==0)fail('SETUP_DENIED',403);
   const result=await setup(env,await body(request));return respond(result.body,200,{'Set-Cookie':result.cookie});
  }
  if(path==='/api/login'&&request.method==='POST'){
   const result=await login(request,env,await body(request));return respond(result.body,200,{'Set-Cookie':result.cookie});
  }
  if(path==='/api/logout'&&request.method==='POST'){
   const token=(request.headers.get('Cookie')||'').split(/;\s*/).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
   if(token)await q(env.DB,'DELETE FROM sessions WHERE token_hash=?',b64(await hash(token))).run();
   return respond({ok:true},200,{'Set-Cookie':setCookie('',true)});
  }
  const s=await session(request,env,{allowChange:path==='/api/session'||path==='/api/password',admin:path.startsWith('/api/admin/')});
  if(path==='/api/session'&&request.method==='GET')return respond(publicUser(s.user,s.expires));
  if(path==='/api/password'&&request.method==='POST'){
   const result=await changePassword(env,s,await body(request));return respond(result.body,200,{'Set-Cookie':result.cookie});
  }
  if(path==='/api/admin/diagnostics'&&request.method==='GET')return respond(await checkGoogleSheetsConnection(env,io));
  if(path==='/api/admin/users'&&request.method==='GET'){
   const rows=await q(env.DB,'SELECT * FROM users ORDER BY created_at,id').all();
   return respond({users:rows.results.map(u=>publicUser(u)),currentUser:publicUser(s.user,s.expires),players:JSON.parse(env.PLAYERS_JSON||'[]')});
  }
  if(path==='/api/admin/users'&&request.method==='POST')return respond(await createUser(env,s,await body(request)),201);
  if(path.startsWith('/api/admin/users/')&&request.method==='PATCH')return respond(await updateUser(env,s,path.split('/').at(-1),await body(request)));
  if(path==='/api/data'&&request.method==='POST')return respond(await readData(env,s,await body(request),io));
  return respond({code:'NOT_FOUND'},404);
 }catch(e){return respond({code:publicErrors.has(e.message)?e.message:'REQUEST_FAILED'},e.status||500);}
}
export default {fetch:(request,env)=>handle(request,env)};