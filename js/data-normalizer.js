import {mapHeaders,validateField,canonical} from './data-validator.js';

export function parseTimestamp(raw) {
  if (raw == null || raw === '') return null;
  const text=String(raw).trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial=Number(text); if(serial<1 || serial>2958465)return null;
    return new Date(Date.UTC(1899,11,30)+Math.round(serial*86400000)+5*3600000).toISOString();
  }
  let m=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [,month,day,year,hour='0',minute='0',second='0']=m, parts=[+year,+month,+day,+hour,+minute,+second];
    const check=new Date(Date.UTC(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]));
    if(check.getUTCFullYear()!==parts[0]||check.getUTCMonth()!==parts[1]-1||check.getUTCDate()!==parts[2]||parts[3]>23||parts[4]>59||parts[5]>59)return null;
    return new Date(check.getTime()+5*3600000).toISOString();
  }
  if(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(text)) {
    const millis=Date.parse(text);return Number.isNaN(millis)?null:new Date(millis).toISOString();
  }
  return null;
}
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(v=>v.toString(16).padStart(2,'0')).join('');
export function fieldValue(row,id){return row?.fields[id]?.status==='VALID'?row.fields[id].value:null;}

export async function normalizeDataset(payload,schema) {
  if(!payload || !Array.isArray(payload.rows) || !['DEMO','REAL'].includes(payload.source?.datasetKind))throw new Error('DATA_CONTRACT');
  if(payload.source.datasetKind==='REAL' && payload.source.simulated)throw new Error('MIXED_SOURCE');
  const {indexes,warnings}=mapHeaders(payload.headers,schema);
  const rows=[],seen=new Set(); let duplicates=0;
  const redacted=new Set(payload.redactedFields||[]);
  const allowed=schema.fields.filter(f=>f.questionId&&!redacted.has(f.id));
  for(let i=0;i<payload.rows.length;i++) {
    const entry=payload.rows[i],cells=Array.isArray(entry)?entry:entry.values;
    if(!Array.isArray(cells)||cells.length!==schema.columnCount)throw new Error('ROW_COLUMNS');
    const timestampRaw=cells[indexes.timestamp], timestamp=parseTimestamp(timestampRaw);
    const canonicalCells=schema.fields.map(f=>{
      const v=cells[indexes[f.id]];
      return f.id==='q54'?null:f.id==='timestamp'?timestamp||v:v==null||canonical(v)===''?null:typeof v==='string'?canonical(v):v;
    });
    // Full row digest disambiguates same-day matches; genuine identical duplicate exports remain idempotent.
    const id=entry.responseId || `row-${await digest(JSON.stringify([timestamp||timestampRaw,...canonicalCells]))}`;
    if(seen.has(id)){duplicates++;continue;}seen.add(id);
    const fields={};
    for(const f of allowed) {
      fields[f.id]=validateField(cells[indexes[f.id]],f,fields);
      if(fields[f.id].warning)warnings.push({code:fields[f.id].warning,field:f.id,rowId:id});
    }
    const row={id,timestamp,timestampRaw,sourceIndex:i,fields};
    if(!timestamp)warnings.push({code:'INVALID_TIMESTAMP',rowId:id});
    const own=fieldValue(row,'q11'),other=fieldValue(row,'q12');
    row.regulation=own==null||other==null?null:{own,other,result:own===other?'Empate':own>other?'Victoria':'Derrota'};
    row.penalties=fieldValue(row,'q39')==='Sí'?{own:fieldValue(row,'q41'),other:fieldValue(row,'q42'),result:fieldValue(row,'q40')}:null;
    if(String(fieldValue(row,'q10')).includes('penales'))warnings.push({code:'REGULATION_LABEL_HAS_PENALTIES',rowId:id});
    if(row.penalties&&row.regulation&&own!==other)warnings.push({code:'SHOOTOUT_WITH_NON_TIE',rowId:id});
    rows.push(row);
  }
  rows.sort((a,b)=>(a.timestamp||'9999').localeCompare(b.timestamp||'9999')||a.sourceIndex-b.sourceIndex);
  return {rows,warnings,duplicates,source:payload.source,redactedFields:[...redacted],syncedAt:new Date().toISOString()};
}
