import {fieldValue} from './data-normalizer.js';
export function measure(rows,field) {
  const m={n_valid:0,n_eligible:0,n_missing:0,n_no:0,n_na:0,n_invalid:0,mean:null,frequencies:[],points:[]},freq=new Map(),numbers=[];
  for(const row of rows) {
    const f=row.fields[field.id]; if(!f)continue;
    if(f.status==='NOT_APPLICABLE')m.n_na++; else m.n_eligible++;
    const count={VALID:'n_valid',MISSING:'n_missing',NOT_OBSERVED:'n_no',INVALID:'n_invalid'}[f.status];if(count)m[count]++;
    if(f.status==='VALID') {
      for(const value of Array.isArray(f.value)?new Set(f.value):[f.value])freq.set(value,(freq.get(value)||0)+1);
      if(typeof f.value==='number')numbers.push(f.value);
    }
    const value=f.status==='VALID'?(field.type==='ordinal'?field.options.indexOf(f.value)+1:typeof f.value==='number'?f.value:null):null;
    m.points.push({id:row.id,date:row.timestamp,value:row.timestamp?value:null,status:f.status,label:f.value});
  }
  m.mean=numbers.length?numbers.reduce((a,b)=>a+b,0)/numbers.length:null;
  m.frequencies=[...freq].map(([label,count])=>({label,count,percentage:m.n_valid?count/m.n_valid*100:0})).sort((a,b)=>b.count-a.count);
  return m;
}
export function filterRows(rows,filters={}) {
  let selected=rows.filter(row=>Object.entries(filters.values||{}).every(([id,value])=>!value||fieldValue(row,id)===value));
  if(filters.from)selected=selected.filter(r=>r.timestamp&&r.timestamp>=`${filters.from}T05:00:00.000Z`);
  if(filters.to)selected=selected.filter(r=>r.timestamp&&r.timestamp<new Date(Date.parse(`${filters.to}T05:00:00.000Z`)+86400000).toISOString());
  return filters.count?selected.slice(-Number(filters.count)):selected;
}
export const choices=(rows,id)=>[...new Set(rows.map(r=>fieldValue(r,id)).filter(v=>v!=null))].sort((a,b)=>String(a).localeCompare(String(b),'es'));
