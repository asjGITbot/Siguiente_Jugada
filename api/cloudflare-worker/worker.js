import schema from '../../config/form-v04.schema.json' with {type:'json'};
import {mapHeaders,canonical} from '../../js/data-validator.js';

const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const parse=value=>JSON.parse(new TextDecoder().decode(decode(value)));
const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const pemBytes=value=>decode(value.replace(/-----[^-]+-----/g,'').replace(/\s+/g,''));
function fail(code,status=403){const e=new Error(code);e.status=status;throw e;}

export function sheetIdFromUrl(value) {
  let u;try{u=new URL(value);}catch{fail('INVALID_SHEET_URL',400);}
  const match=u.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/.*)?$/);
  if(u.protocol!=='https:'||u.hostname!=='docs.google.com'||u.port||u.username||u.password||!match)fail('INVALID_SHEET_URL',400);
  return match[1];
}

export async function verifyAccess(token,env,io) {
  if(!token||token.length>16384)fail('AUTH_REQUIRED',401);
  if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN||''))fail('EXTERNAL_SETUP_REQUIRED',503);
  let header,claims,parts;
  try{parts=token.split('.');if(parts.length!==3)throw 0;header=parse(parts[0]);claims=parse(parts[1]);}catch{fail('AUTH_REQUIRED',401);}
  if(header.alg!=='RS256'||typeof header.kid!=='string')fail('AUTH_REQUIRED',401);
  const issuer=`https://${env.ACCESS_TEAM_DOMAIN}`,now=Math.floor(io.now()/1000),aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(claims.iss!==issuer||!aud.includes(env.ACCESS_AUDIENCE)||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+30||(claims.nbf&&claims.nbf>now+30)||typeof claims.email!=='string')fail('AUTH_REQUIRED',401);
  const certs=await io.fetch(issuer+'/cdn-cgi/access/certs',{cache:'no-store'});
  if(!certs.ok)fail('AUTH_UNAVAILABLE',503);
  const jwks=await certs.json(),jwk=jwks.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)fail('AUTH_REQUIRED',401);
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))fail('AUTH_REQUIRED',401);
  return claims;
}

export async function googleToken(env,io) {
  // Only stable, non-sensitive error codes escape this function. Never return provider error descriptions.
  if(!env.GOOGLE_SERVICE_ACCOUNT_JSON)fail('GOOGLE_CREDENTIALS_MISSING',503);
  let account;
  try{account=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);}catch{fail('GOOGLE_CREDENTIALS_JSON_INVALID',503);}
  if(account?.type!=='service_account'||typeof account.client_email!=='string'||
     !account.client_email.endsWith('.iam.gserviceaccount.com')||
     typeof account.private_key!=='string'||
     !account.private_key.includes('-----BEGIN PRIVATE KEY-----')||
     !account.private_key.includes('-----END PRIVATE KEY-----'))fail('GOOGLE_CREDENTIALS_FORMAT_INVALID',503);
  let key;
  try{key=await crypto.subtle.importKey('pkcs8',pemBytes(account.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);}
  catch{fail('GOOGLE_PRIVATE_KEY_INVALID',503);}
  const now=Math.floor(io.now()/1000);
  const head=encode({alg:'RS256',typ:'JWT'}),body=encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  let signature;
  try{signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(head+'.'+body));}
  catch{fail('GOOGLE_JWT_SIGN_FAILED',503);}
  const signed=btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  let response;
  try{response=await io.fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:head+'.'+body+'.'+signed}),cache:'no-store'});}
  catch{fail('GOOGLE_OAUTH_NETWORK_FAILED',502);}
  if(!response.ok){
    let kind;
    try{kind=(await response.json()).error;}catch{}
    const allowed={invalid_grant:'GOOGLE_OAUTH_INVALID_GRANT',invalid_client:'GOOGLE_OAUTH_INVALID_CLIENT',unauthorized_client:'GOOGLE_OAUTH_UNAUTHORIZED_CLIENT',invalid_scope:'GOOGLE_OAUTH_INVALID_SCOPE',invalid_request:'GOOGLE_OAUTH_INVALID_REQUEST'};
    fail(allowed[kind]||'GOOGLE_OAUTH_HTTP_FAILED',502);
  }
  let result;
  try{result=await response.json();}catch{fail('GOOGLE_OAUTH_RESPONSE_INVALID',502);}
  if(typeof result?.access_token!=='string'||!result.access_token)fail('GOOGLE_OAUTH_NO_ACCESS_TOKEN',502);
  return result.access_token;
}

export function authorizeRows(values,user,kind) {
  if(!Array.isArray(values)||!values.length)fail('SCHEMA_HEADERS',422);
  const headers=values[0];let indexes;try{({indexes}=mapHeaders(headers,schema));}catch{fail('SCHEMA_HEADERS',422);}
  if(!Array.isArray(user.players)||!user.players.length)fail('ACCESS_DENIED');
  const canReadP54=user.role!=='player'&&user.canReadP54===true;
  const rows=values.slice(1).filter(r=>user.players.some(p=>canonical(p)===canonical(r[indexes.q1]))).map(raw=>{
    if(raw.length>schema.columnCount)fail('ROW_COLUMNS',422);
    const cells=Array.from({length:schema.columnCount},(_,i)=>raw[i]??null);
    if(!canReadP54)cells[indexes.q54]=null;
    return {values:cells};
  });
  return {schemaVersion:schema.version,source:{datasetKind:kind,simulated:kind==='DEMO',transport:'GOOGLE_SHEETS',label:'Google Sheets privado',sourceColumnCount:schema.columnCount},headers,rows,redactedFields:canReadP54?[]:['q54']};
}

export async function handle(request,env,io={fetch:globalThis.fetch,now:()=>Date.now()}) {
  const origin=request.headers.get('Origin'),allowedOrigin=env.APP_ORIGIN;
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
  if(origin&&origin===allowedOrigin){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Credentials']='true';}
  const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  try{
    if(!allowedOrigin||new URL(allowedOrigin).protocol!=='https:')fail('EXTERNAL_SETUP_REQUIRED',503);
    if(new URL(request.url).protocol!=='https:')fail('HTTPS_REQUIRED',400);
    if(origin&&origin!==allowedOrigin)fail('ORIGIN_DENIED');
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
    const claims=await verifyAccess(request.headers.get('Cf-Access-Jwt-Assertion'),env,io);
    const users=JSON.parse(env.APP_USERS_JSON||'{}'),user=users[claims.email.toLowerCase()];
    if(!user||!['player','parent','psychologist'].includes(user.role))fail('ACCESS_DENIED');
    const path=new URL(request.url).pathname;
    if(path==='/auth/session'&&request.method==='GET')return respond({role:user.role,simulated:false,displayName:user.displayName||'Mi perfil',canReadP54:user.role!=='player'&&user.canReadP54===true,expiresAt:claims.exp*1000});
    if(path!=='/data'||request.method!=='POST')return respond({code:'NOT_FOUND'},404);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail('BAD_REQUEST',400);
    const text=await request.text();if(text.length>8192)fail('BAD_REQUEST',413);
    let body;try{body=JSON.parse(text);}catch{fail('BAD_REQUEST',400);}
    const id=sheetIdFromUrl(body.googleSheetsUrl),sheets=JSON.parse(env.ALLOWED_SHEETS_JSON||'{}'),sheet=sheets[id];
    if(!sheet||!user.sheetIds?.includes(id)||!['DEMO','REAL'].includes(sheet.datasetKind))fail('SHEET_NOT_AUTHORIZED');
    if(schema.catalogStatus!=='VERIFIED_PDF')fail('SCHEMA_UNCERTIFIED',503);
    const token=await googleToken(env,io);
    // Range is pre-provisioned by the owner, never taken from the browser.
    if(typeof sheet.range!=='string'||!sheet.range.endsWith('!A:BH'))fail('EXTERNAL_SETUP_REQUIRED',503);
    const url=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(sheet.range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`;
    const result=await io.fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    if(!result.ok)fail(result.status===403?'SHEET_NOT_AUTHORIZED':'SOURCE_UNAVAILABLE',result.status===403?403:502);
    const sheetData=await result.json();return respond(authorizeRows(sheetData.values,user,sheet.datasetKind));
  }catch(error){
    // Never echo exception text from Google, JWTs, row data, sheet IDs or credentials.
    const safe=new Set(['AUTH_REQUIRED','AUTH_UNAVAILABLE','EXTERNAL_SETUP_REQUIRED','ACCESS_DENIED','INVALID_SHEET_URL','SHEET_NOT_AUTHORIZED','SOURCE_UNAVAILABLE','SCHEMA_HEADERS','ROW_COLUMNS','SCHEMA_UNCERTIFIED','BAD_REQUEST','HTTPS_REQUIRED','ORIGIN_DENIED']);
    return respond({code:safe.has(error.message)?error.message:'REQUEST_FAILED'},error.status||500);
  }
}
export default {fetch(request,env){return handle(request,env);}};
