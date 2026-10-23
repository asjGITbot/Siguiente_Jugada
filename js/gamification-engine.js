export function matches(row,rule) {
  const valid=id=>row.fields[id]?.status==='VALID';
  if(rule.allValid&&!rule.allValid.every(valid))return false;
  if(rule.anyValid&&!rule.anyValid.some(valid))return false;
  if(rule.values&&!Object.entries(rule.values).every(([id,values])=>valid(id)&&values.includes(row.fields[id].value)))return false;
  return true;
}
export function adventure(rows,config) {
  const unique=[...new Map(rows.map(r=>[r.id,r])).values()],events=[];
  for(const row of unique)for(const rule of config.xpRules)if(matches(row,rule))events.push({rowId:row.id,rule_id:rule.id,xp:rule.xp,label:rule.label,evidence:[...(rule.allValid||[]),...(rule.anyValid||[]).filter(id=>row.fields[id]?.status==='VALID')]});
  const xp=events.reduce((sum,e)=>sum+e.xp,0),step=config.levelStepXP,level=Math.floor(xp/step)+1,progress=xp%step;
  const badges=config.badges.map(b=>{
    const evidence=b.rule?events.filter(e=>e.rule_id===b.rule).map(e=>e.rowId):unique.filter(r=>matches(r,b)).map(r=>r.id);
    return {...b,evidence,count:evidence.length,earned:evidence.length>=b.goal};
  });
  return {xp,level,progress,step,remaining:step-progress,percent:progress/step*100,events,badges};
}
