import {measure} from './metrics-engine.js';
import {esc,dateLabel,number} from './components/ui.js';
const instances=new Set();
export function clearCharts(){for(const c of instances)c.destroy();instances.clear();}
export function renderCharts(root,rows,schema,charts,ui,sourceConfig) {
  if(!globalThis.Chart)throw new Error('CHART_LIBRARY_MISSING');
  Chart.defaults.color='#b1bfd0';Chart.defaults.font.family='Segoe UI, Arial, sans-serif';Chart.defaults.animation=false;
  root.querySelectorAll('[data-chart]').forEach((canvas,index)=>{
    const f=schema.fields.find(f=>f.id===canvas.dataset.chart),spec=charts.fields.find(c=>c.field===f.id),m=measure(rows,f),card=canvas.closest('[data-chart-card]');
    const sequential=['scale','ordinal'].includes(f.type),dated=m.points.filter(p=>p.value!==null),minimum=spec.trendMinN??charts.trendMinN;
    card.querySelector('[data-coverage]').textContent=`${m.n_valid} válidas / ${m.n_eligible} elegibles`;
    card.querySelector('[data-counts]').textContent=`${m.n_missing} sin respuesta · ${m.n_no} N/O · ${m.n_na} no aplica · ${m.n_invalid} inválidas. Cada gráfico usa sus propias respuestas válidas.${f.type==='multi'?' Una marca por partido; los porcentajes pueden sumar más de 100 %.':''}`;
    const latest=m.points.filter(p=>p.status==='VALID').at(-1),summary=card.querySelector('[data-summary]');
    summary.innerHTML=sequential?`<strong>${f.type==='scale'&&m.mean!=null?number(m.mean,sourceConfig):m.n_valid}</strong><span class="muted">${f.type==='scale'?'promedio de respuestas':'respuestas registradas'}</span>`:`<strong>${m.n_valid}</strong><span class="muted">respuestas válidas</span>`;
    const note=card.querySelector('[data-chart-note]');
    if(!m.n_valid || m.n_valid<minimum || (sequential&&dated.length<minimum)){note.hidden=false;note.textContent=m.n_valid===1?ui.texts.onePoint:ui.texts.insufficient;}
    if(!m.n_valid){canvas.parentElement.hidden=true;return;}
    if(!sequential&&spec.type==='response'){canvas.parentElement.hidden=true;summary.innerHTML=`<p class="small">${esc(latest?.label??'—')}</p>`;return;}
    const color=charts.colors[index%charts.colors.length];
    let data,options={responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#07111e',borderColor:'#536880',borderWidth:1,padding:12,titleColor:'#fff',bodyColor:'#e0e7ef'}},scales:{x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:5,font:{size:10}},border:{display:false}},y:{beginAtZero:true,grid:{color:'#26394d'},border:{display:false},ticks:{precision:0,font:{size:10}}}}};
    if(sequential) {
      data={labels:m.points.map(p=>dateLabel(p.date,sourceConfig)),datasets:[{data:m.points.map(p=>p.value),borderColor:color,backgroundColor:color,pointRadius:dated.length<minimum?5:2,pointHoverRadius:6,borderWidth:2,tension:0,spanGaps:false,showLine:dated.length>=minimum}]};
      options.scales.y={...options.scales.y,min:1,max:f.type==='scale'?5:f.options.length,ticks:{stepSize:1,font:{size:10},callback:value=>f.type==='scale'?value:`Opción ${value}`}};
      options.plugins.tooltip.callbacks={label:ctx=>String(m.points[ctx.dataIndex].label??''),afterLabel:()=>`${m.n_valid} válidas / ${m.n_eligible} elegibles`};
      if(f.type==='ordinal'){note.hidden=false;note.textContent=(dated.length<minimum?ui.texts.insufficient+' · ':'')+'Orden de opciones del formulario; no es una escala clínica.';}
    } else {
      const labels=m.frequencies.map(v=>String(v.label));
      data={labels,datasets:[{data:m.frequencies.map(v=>v.count),backgroundColor:color,borderRadius:4,barThickness:13,maxBarThickness:16}]};
      options.indexAxis='y';options.scales.x={...options.scales.x,beginAtZero:true,ticks:{precision:0,font:{size:10}},grid:{color:'#26394d'}};
      options.scales.y={grid:{display:false},border:{display:false},ticks:{font:{size:10},callback:(value)=>labels[value]?.length>26?labels[value].slice(0,25)+'…':labels[value]}};
      canvas.parentElement.style.height=`${Math.max(170,labels.length*30)}px`;
      options.plugins.tooltip.callbacks={title:ctx=>labels[ctx[0].dataIndex],label:ctx=>`${ctx.raw} partidos · ${number(m.frequencies[ctx.dataIndex].percentage,sourceConfig)}% de válidas`};
    }
    const chart=new Chart(canvas,{type:sequential?'line':'bar',data,options});instances.add(chart);
    canvas.setAttribute('aria-label',`${f.shortTitle}: ${m.n_valid} válidas de ${m.n_eligible} elegibles. ${m.mean==null?'':`Promedio ${number(m.mean,sourceConfig)}.`} Ver tabla de respuestas para todos los datos.`);
  });
}
