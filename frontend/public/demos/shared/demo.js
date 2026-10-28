import {MODES,initialData,addRecord,changeRecord,matching,restoreRecords,today,futureDate} from './model.js';
const mode=document.body.dataset.demo,config=MODES[mode];
const key='ciem-demo-v1-'+mode;
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(n);
let records=initialData(mode);
try { const saved=localStorage.getItem(key); if(saved!==null) records=restoreRecords(mode,JSON.parse(saved)); } catch { $('#feedback').textContent='No se pudieron recuperar los cambios anteriores. Se cargaron los ejemplos.'; }
function element(tag,text,className) {const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function feedback(text){$('#feedback').textContent=text;}
function save(next){records=next;try{localStorage.setItem(key,JSON.stringify(records));}catch{feedback('Los cambios funcionan en esta sesión, pero el navegador no permite guardarlos.');}render();}
function button(text,handler,disabled=false){const b=element('button',text);b.type='button';b.disabled=disabled;b.onclick=handler;return b;}
function act(id,action){try{feedback('');save(changeRecord(mode,records,id,action));}catch(e){feedback(e.message);}}
function render(){
 const rows=matching(records,$('#search').value,$('#status').value);
 const head=$('#table-head');head.replaceChildren();
 const headers=mode==='crm-comercial'?['Empresa / proyecto','Valor estimado','Etapa','Acciones']:mode==='gestion-inventario'?['Producto','SKU','Stock','Costo unitario','Movimientos']:['Cliente de ejemplo','Servicio / fecha','Estado','Acciones'];
 for(const label of headers)head.append(element('th',label));
 const body=$('#table-body');body.replaceChildren();
 for(const row of rows){
  const tr=element('tr');tr.append(element('td',row.name));
  if(mode==='crm-comercial')tr.append(element('td',money(row.amount)));
  if(mode==='gestion-inventario'){
   tr.append(element('td',row.sku));const td=element('td');td.append(element('span',String(row.quantity),row.quantity<5?'badge warn':'badge good'));tr.append(td,element('td',money(row.amount)));
  } else {
   if(mode==='plataforma-reservas'){
    const td=element('td');td.append(element('div',row.service),element('small',row.date.split('-').reverse().join('/')+' · '+row.time,'muted'));tr.append(td);
   }
   const td=element('td');td.append(element('span',row.status,'badge '+(['Ganado','Confirmada','Completada'].includes(row.status)?'good':row.status==='Cancelada'?'warn':'')));tr.append(td);
  }
  const td=element('td'),actions=element('div',undefined,'actions');
  if(mode==='gestion-inventario')actions.append(button('+1 Entrada',()=>act(row.id,'plus')),button('−1 Salida',()=>act(row.id,'minus'),row.quantity===0));
  else if(mode==='crm-comercial')actions.append(button('Avanzar →',()=>act(row.id,'advance'),row.status==='Ganado'));
  else actions.append(button(row.status==='Pendiente'?'Confirmar':'Completar',()=>act(row.id,'advance'),['Completada','Cancelada'].includes(row.status)),button('Cancelar',()=>act(row.id,'cancel'),['Completada','Cancelada'].includes(row.status)));
  td.append(actions);tr.append(td);body.append(tr);
 }
 $('#empty').hidden=rows.length>0;$('#result-count').textContent=rows.length+' de '+records.length+' registros';
 let stats;
 if(mode==='crm-comercial')stats=[['Oportunidades',records.length],['Valor en seguimiento',money(records.filter(r=>r.status!=='Ganado').reduce((a,r)=>a+r.amount,0))],['Ganadas',records.filter(r=>r.status==='Ganado').length]];
 else if(mode==='gestion-inventario')stats=[['Productos',records.length],['Unidades en stock',records.reduce((a,r)=>a+r.quantity,0)],['Stock bajo (< 5)',records.filter(r=>r.quantity<5).length]];
 else stats=[['Reservas activas',records.filter(r=>['Pendiente','Confirmada'].includes(r.status)).length],['Por confirmar',records.filter(r=>r.status==='Pendiente').length],['Confirmadas',records.filter(r=>r.status==='Confirmada').length]];
 const statsEl=$('#stats');statsEl.replaceChildren();for(const [label,value] of stats){const box=element('div',undefined,'stat');box.append(element('small',label),element('strong',String(value)));statsEl.append(box);}
}
const form=$('#record-form');
for(const [name,label,type]of config.fields){
 const wrap=element('div'),lab=element('label',label);lab.htmlFor='field-'+name;
 const input=element(type==='select'?'select':'input');input.id='field-'+name;input.name=name;input.required=true;
 if(type==='select'){
  const options=name==='service'?['Asesoría','Reunión de proyecto','Consulta inicial']:['09:00','10:00','11:00','14:00','15:00','16:00'];
  for(const value of options){const option=element('option',value);option.value=value;input.append(option);}
 }else{input.type=type;if(type==='number'){input.min='0';input.max=name==='quantity'?'100000':'10000000';input.step=name==='quantity'?'1':'0.01';}else if(type==='date'){input.min=today();input.value=futureDate();}else{input.maxLength=name==='sku'?24:100;input.autocomplete='off';}}
 wrap.append(lab,input);form.insertBefore(wrap,$('#save-record'));
}
for(const stage of config.stages){const option=element('option',stage);option.value=stage;$('#status').append(option);}
if(!config.stages.length)$('#status').hidden=true;
form.addEventListener('submit',event=>{
 event.preventDefault();feedback('');
 try{const next=addRecord(mode,records,Object.fromEntries(new FormData(form)),crypto.randomUUID());save(next);form.reset();const date=form.elements.namedItem('date');if(date)date.value=futureDate();feedback('Registro añadido. Puedes seguir probando la demo.');}catch(e){feedback(e.message);}
});
$('#search').addEventListener('input',render);$('#status').addEventListener('change',render);
$('#new-record').onclick=()=>{form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.namedItem('name').focus({preventScroll:true});};
$('#reset').onclick=()=>{if(!confirm('¿Restablecer los datos de esta demo? Se perderán únicamente tus cambios de ejemplo.'))return;feedback('');$('#search').value='';$('#status').value='';save(initialData(mode));};
render();
