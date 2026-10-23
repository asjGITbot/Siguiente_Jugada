import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeDataset,parseTimestamp,fieldValue} from '../js/data-normalizer.js';
import {validateField,mapHeaders} from '../js/data-validator.js';
import {measure,filterRows} from '../js/metrics-engine.js';
import {adventure} from '../js/gamification-engine.js';
import {missionHistory} from '../js/missions-engine.js';
import {selectMessage} from '../js/messages-engine.js';
import {SessionStore} from '../js/data-loader.js';
const load=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const schema=await load('config/form-v04.schema.json'),game=await load('config/gamification.json'),missions=await load('config/mission-rules.json'),messages=await load('config/messages.json'),charts=await load('config/charts.json');
const demo=await load('tests/fixtures/http-demo-100.json'),history=await load('tests/fixtures/http-history-28.json');
const f=id=>schema.fields.find(f=>f.id===id),copy=x=>structuredClone(x);
const data=await normalizeDataset(demo,schema);

test('V04: 54 questions, 60 fields, 7 blocks, every field traceable including 6 P53 rows',()=>{
  assert.equal(schema.questions.length,54);assert.equal(schema.fields.length,60);assert.equal(schema.sections.length,7);
  assert.equal(new Set(schema.fields.map(f=>f.id)).size,60);assert.equal(schema.questions.find(q=>q.id==='q53').fields.length,6);
  assert.equal(charts.fields.length,58);for(const field of schema.fields.filter(f=>f.questionId&&f.id!=='q54'))assert(charts.fields.some(c=>c.field===field.id));
  assert.equal(missions.rules.length,f('q38').options.length);assert.equal(schema.catalogStatus,'VERIFIED_PDF');
});
test('100 HTTP records normalized; P29 contamination excluded and raw preserved; J alias warned',()=>{
  assert.equal(data.rows.length,100);assert(data.warnings.some(w=>w.code==='HEADER_ALIAS'&&w.field==='q9'));
  const invalid=data.rows.filter(r=>r.fields.q29.status==='INVALID');assert.equal(invalid.length,12);assert(invalid.every(r=>r.fields.q29.raw==='Lo intenté con dudas.'));
  assert.equal(measure(data.rows,f('q29')).n_valid,88);
});
test('28 incomplete records, one request for ball remains one, never zero or false trend',async()=>{
  const d=await normalizeDataset(history,schema),m=measure(d.rows,f('q23'));assert.equal(m.n_valid,1);assert.equal(m.n_missing,27);assert.equal(m.n_eligible,28);assert.equal(m.frequencies[0].count,1);
  const confidence=measure(d.rows,f('q16'));assert(confidence.n_valid<28);assert(confidence.mean>=1);
});
test('missing, explicit zero, No category, N/O and invalid are distinct',()=>{
  assert.equal(validateField('',f('q11')).status,'MISSING');assert.equal(validateField(0,f('q11')).value,0);
  assert.equal(validateField('No',f('q25')).value,'No');assert.equal(validateField(0,f('q15')).status,'INVALID');
  assert.equal(validateField('N/O',f('q53.buscoparticipar')).status,'NOT_OBSERVED');assert.equal(validateField('No',f('q11')).status,'INVALID');
});
test('conditional absence is NOT_APPLICABLE and contradictory raw is retained',()=>{
  for(const [parent,child] of [['q25','q26'],['q25','q28'],['q32','q35'],['q39','q45']]){
    const value=validateField(4,f(child),{[parent]:{status:'VALID',value:'No'}});assert.equal(value.status,'NOT_APPLICABLE');assert.equal(value.raw,4);assert.equal(value.warning,'VALUE_WHEN_NOT_APPLICABLE');
  }
});
test('six independent observer metrics; N/O excluded, gaps are explicit',()=>{
  for(const field of schema.fields.filter(f=>f.questionId==='q53')){const m=measure(data.rows,field);assert(m.n_no>0);assert.equal(m.n_valid+m.n_no,100);assert(m.mean>=1&&m.mean<=5);assert.equal(m.points.filter(p=>p.value===null).length,m.n_no);}
});
test('multiselect once per match and literal commas preserved',()=>{
  const v=validateField(['Papá','Papá','Mamá'],f('q13'));assert.deepEqual(v.value,['Papá','Mamá']);
  assert.equal(validateField('Mala suerte (poste, rebote, etc.)',f('q37'),{q32:{status:'VALID',value:'Sí'}}).status,'VALID');
  assert.equal(validateField('Papá, Mamá',f('q13')).status,'VALID');
});
test('timestamps are MDY / Excel with Lima offset; impossible and ambiguous dates rejected',()=>{
  assert.equal(parseTimestamp('6/24/2026 17:39:00'),'2026-06-24T22:39:00.000Z');assert.equal(parseTimestamp('24/6/2026 17:39:00'),null);
  assert.equal(parseTimestamp('2/30/2026 12:00:00'),null);assert.equal(parseTimestamp(46197.5),'2026-06-24T17:00:00.000Z');
});
test('dedup is idempotent, same day different matches survive, XP repeats identically',async()=>{
  const p=copy(demo);p.rows=[copy(p.rows[0]),copy(p.rows[0]),copy(p.rows[1])];p.rows[2].values[0]=p.rows[0].values[0];
  const d=await normalizeDataset(p,schema);assert.equal(d.rows.length,2);assert.equal(d.duplicates,1);
  assert.equal(adventure(d.rows,game).xp,adventure((await normalizeDataset(p,schema)).rows,game).xp);
  assert.equal(adventure([...d.rows,...d.rows],game).xp,adventure(d.rows,game).xp);
});
test('a regulation draw with penalties retains both scores',()=>{
  const r=data.rows.find(r=>r.penalties);assert.equal(r.regulation.own,r.regulation.other);assert.equal(r.penalties.own,4);assert.equal(r.penalties.other,3);assert.equal(r.penalties.result,'Ganamos');
});
test('global XP unaffected by filters or outcomes and emotions value, losses never subtract',()=>{
  const before=adventure(data.rows,game),changed=copy(data.rows);for(const row of changed){row.fields.q10={status:'VALID',value:'Perdimos'};if(row.fields.q16.status==='VALID')row.fields.q16.value=1;}
  assert.equal(adventure(changed,game).xp,before.xp);const subset=filterRows(data.rows,{values:{q2:'ADT'}});assert(subset.length<100);assert.equal(adventure(data.rows,game).xp,before.xp);
  assert.equal(before.remaining,game.levelStepXP-before.progress);assert(before.events.every(e=>e.xp>0&&e.evidence.length>0));
});
test('mission N→N+1 only, latest pending, missing evidence SIN_DATOS',()=>{
  const rows=copy(data.rows.slice(0,3));rows[0].fields.q38={status:'VALID',value:missions.rules[0].option};rows[1].fields.q23={status:'MISSING',value:null};rows[2].fields.q23={status:'VALID',value:missions.rules[0].favorableValues[0]};rows[2].fields.q38={status:'VALID',value:missions.rules[0].option};
  const result=missionHistory(rows,missions);assert.equal(result[0].state,'SIN_DATOS');assert.equal(result.at(-1).state,'PENDIENTE');assert.equal(result[0].nextId,rows[1].id);
});
test('messages are deterministic, <=120 characters, with rule id and evidence',()=>{
  assert(messages.rules.every(r=>r.text.length<=120));const m=selectMessage(data.rows,messages);assert(m.id);assert(m.evidence.length>0);assert.deepEqual(selectMessage(data.rows,messages),m);
});
test('invalid headers fail closed',()=>{
  assert.throws(()=>mapHeaders(demo.headers.slice(0,59),schema),/SCHEMA_COLUMNS/);const h=copy(demo.headers);h[4]='Unexpected';assert.throws(()=>mapHeaders(h,schema),/SCHEMA_HEADERS/);
});
test('one source call per successful login, double-click single flight, no polling even at +60 min',async t=>{
  let calls=0;const store=new SessionStore({config:async()=>({}),auth:async()=>({role:'player'}),fetch:async()=>{calls++;return demo;},normalize:p=>normalizeDataset(p,schema)});
  const first=store.login('demo','player'),second=store.login('demo','player');assert.equal(first,second);await Promise.all([first,second]);assert.equal(calls,1);
  for(let n=0;n<6;n++)filterRows(store.current.data.rows,{values:{q2:'ADT'}});
  t.mock.timers.enable({apis:['setTimeout']});t.mock.timers.tick(3600000);assert.equal(calls,1);assert(await store.login('demo','player'));assert.equal(calls,1);
  store.logout();assert.equal(store.current,null);await store.login('demo','player');assert.equal(calls,2);
});
test('logout cancels in-flight response and no late dataset is restored',async()=>{
  let resolve;const response=new Promise(r=>resolve=r),store=new SessionStore({config:async()=>({}),auth:async()=>({role:'player'}),fetch:async()=>response,normalize:p=>normalizeDataset(p,schema)});
  const promise=store.login('demo','player');store.logout();resolve(demo);await assert.rejects(promise,{name:'AbortError'});assert.equal(store.current,null);
});
test('changing only GOOGLE_SHEETS_URL selects next authorized mock source; no fallback on denial',async()=>{
  const config={GOOGLE_SHEETS_URL:'https://docs.google.com/spreadsheets/d/MOCK_DEMO/edit',API_BASE_URL:'https://private.example'};let called=[];
  const store=new SessionStore({config:async()=>({...config}),auth:async()=>({role:'player'}),fetch:async c=>{called.push(c.GOOGLE_SHEETS_URL);if(c.GOOGLE_SHEETS_URL.includes('DENIED'))throw new Error('SHEET_NOT_AUTHORIZED');return c.GOOGLE_SHEETS_URL.includes('HISTORY')?history:demo;},normalize:p=>normalizeDataset(p,schema)});
  assert.equal((await store.login()).data.rows.length,100);store.logout();config.GOOGLE_SHEETS_URL='https://docs.google.com/spreadsheets/d/MOCK_HISTORY_28/edit';assert.equal((await store.login()).data.rows.length,28);store.logout();config.GOOGLE_SHEETS_URL='https://docs.google.com/spreadsheets/d/MOCK_DENIED/edit';await assert.rejects(store.login(),/SHEET_NOT_AUTHORIZED/);assert.equal(store.current,null);assert.equal(called.length,3);
});
test('service worker only explicit public shell, no response caches / timers / persistent private storage',async()=>{
  const sw=await readFile(new URL('../service-worker.js',import.meta.url),'utf8'),main=await readFile(new URL('../js/main.js',import.meta.url),'utf8');
  assert(sw.includes("req.method!=='GET'||!allowed.has(req.url)"));assert(!sw.includes('public/config/data-source.json'));assert(!sw.includes('tests/fixtures'));assert(!/setInterval|localStorage|indexedDB/.test(main));
});
