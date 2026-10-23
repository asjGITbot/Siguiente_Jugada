import {mapHeaders} from './data-validator.js';
export async function fetchData(config,session,signal,schema) {
  const response=await fetch(session.base+'/data',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json',...(session.mode==='account'?{'X-SSR11-Request':'1'}:{})},body:JSON.stringify({googleSheetsUrl:config.GOOGLE_SHEETS_URL}),signal});
  if(!response.ok)throw new Error(response.status===403?'SHEET_NOT_AUTHORIZED':response.status===401?'SESSION_EXPIRED':'SOURCE_UNAVAILABLE');
  const payload=await response.json();
  if(session.mode==='account'&&(payload.source?.transport!=='AUTHENTICATED_SIMULATION'||payload.source?.simulated!==true))throw new Error('MIXED_SOURCE');
  if(session.mode!=='demo'&&payload.source?.transport==='MOCK_HTTP')throw new Error('MIXED_SOURCE');
  const {indexes}=mapHeaders(payload.headers,schema);
  if(session.role==='player'&&(!payload.redactedFields?.includes('q54')||payload.rows?.some(r=>(r.values||r)[indexes.q54]!=null&&(r.values||r)[indexes.q54]!=='')))throw new Error('FIELD_PERMISSION_VIOLATION');
  return payload;
}

// One in-flight promise per login; navigation has no data source handle.
export class SessionStore {
  constructor(deps){this.deps=deps;this.current=null;this.flight=null;this.generation=0;this.controller=null;}
  login(mode,role) {
    if(this.flight)return this.flight;
    if(this.current)return Promise.resolve(this.current);
    const generation=this.generation,controller=new AbortController();this.controller=controller;
    const run=async()=>{
      this.deps.status?.('Conectando');
      const config=await this.deps.config(controller.signal);
      const session=await this.deps.auth(config,mode,role,controller.signal);
      this.deps.status?.('Revisando mis partidos');
      const payload=await this.deps.fetch(config,session,controller.signal);
      const data=await this.deps.normalize(payload);
      if(generation!==this.generation||controller.signal.aborted)throw new DOMException('Session cancelled','AbortError');
      this.current={config,session,data};this.deps.status?.('Listo');return this.current;
    };
    const promise=run().finally(()=>{if(this.flight===promise)this.flight=null;});this.flight=promise;return promise;
  }
  logout(){const old=this.current;this.generation++;this.controller?.abort();this.controller=null;this.current=null;this.flight=null;return old;}
}
