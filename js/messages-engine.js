import {matches} from './gamification-engine.js';
export function selectMessage(rows,config) {
  for(const rule of [...config.rules].sort((a,b)=>a.priority-b.priority)) {
    if(rule.kind==='fallback')return {...rule,evidence:[]};
    if(rule.kind==='values'&&rows.length&&matches(rows.at(-1),rule))return {...rule,evidence:[rows.at(-1).id]};
    if(rule.kind==='delta') {
      const valid=rows.filter(r=>r.fields[rule.field]?.status==='VALID');if(valid.length<2)continue;
      const a=valid.at(-2),b=valid.at(-1),delta=b.fields[rule.field].value-a.fields[rule.field].value;
      if((rule.direction==='up'&&delta>0)||(rule.direction==='down'&&delta<0))return {...rule,evidence:[a.id,b.id]};
    }
  }
  return null;
}
