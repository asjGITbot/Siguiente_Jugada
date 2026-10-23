import {fieldValue} from './data-normalizer.js';
export function missionHistory(rows,config) {
  return rows.flatMap((row,index)=>{
    const mission=fieldValue(row,'q38');if(!mission)return [];
    const rule=config.rules.find(r=>r.option===mission),next=rows[index+1];let state='PENDIENTE',evidence=null;
    if(next) {
      const response=rule?.evidenceField?next.fields[rule.evidenceField]:null;
      state=response?.status==='VALID'?(rule.favorableValues.includes(response.value)?'EVIDENCIA_FAVORABLE':'EN_PRACTICA'):'SIN_DATOS';
      if(response?.status==='VALID')evidence={rowId:next.id,field:rule.evidenceField,value:response.value};
    }
    return [{rowId:row.id,date:row.timestamp,mission,rule_id:rule?.id||'unmapped',state,evidence,nextId:next?.id,description:rule?.description}];
  });
}
