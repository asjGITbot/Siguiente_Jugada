export function apiBase(config,mode) {
  if(mode==='demo') {
    if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw new Error('DEMO_LOCAL_ONLY');
    return new URL('/__test',location.origin).href;
  }
  const url=new URL(config.API_BASE_URL);
  if(url.protocol!=='https:'||url.hostname.endsWith('.example'))throw new Error('EXTERNAL_SETUP_REQUIRED');
  return url.href.replace(/\/$/,'');
}
export async function authenticate(config,mode,role,signal) {
  if(mode==='account') {
    const response=await fetch('/api/login',{method:'POST',credentials:'same-origin',cache:'no-store',signal,headers:{'Content-Type':'application/json','X-SSR11-Request':'1'},body:JSON.stringify(role)});
    const session=await response.json();if(!response.ok)throw new Error(session.code||'AUTH_REQUIRED');
    if(session.mustChangePassword)throw new Error('PASSWORD_ROUTE');
    if(session.role==='admin')throw new Error('ADMIN_ROUTE');
    if(!['player','parent','psychologist'].includes(session.role))throw new Error('ROLE_DENIED');
    return {...session,base:'/api',mode};
  }
  const base=apiBase(config,mode);
  const response=await fetch(base+(mode==='demo'?'/session':'/auth/session'),{method:mode==='demo'?'POST':'GET',credentials:'include',cache:'no-store',headers:mode==='demo'?{'Content-Type':'application/json'}:{},body:mode==='demo'?JSON.stringify({role}):undefined,signal});
  if(!response.ok)throw new Error(response.status===403?'ACCESS_DENIED':'AUTH_REQUIRED');
  const session=await response.json();
  if(!['player','parent','psychologist'].includes(session.role))throw new Error('ROLE_DENIED');
  if(mode!=='demo'&&session.simulated)throw new Error('MIXED_SOURCE');
  return {...session,base,mode};
}
export async function endSession(session) {
  if(session?.mode==='account') {try{await fetch('/api/logout',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-SSR11-Request':'1'},body:'{}',keepalive:true});}catch{}return;}
  if(session?.mode==='demo')try{await fetch(session.base+'/logout',{method:'POST',credentials:'include',cache:'no-store',keepalive:true});}catch{/* memory already cleared */}
}
