import {SERVICES,RESOURCES,slotsFor,initialBookings,createBooking,updateStatus,loadBookings,today,addDays,timeLabel,minutes} from './model.js';
const $=selector=>document.querySelector(selector),storageKey='ciem-booking-starter-kit-v1';
function node(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
const paths={briefcase:'M9 6V4h6v2M3 7h18v13H3zM3 12h18M10 12v3h4v-3',spark:'m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8z',scissors:'M8 8 20 20M8 16 20 4M8 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',monitor:'M3 4h18v13H3zM12 17v4M8 21h8',home:'m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7',calendar:'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2'};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.calendar);svg.append(path);return svg;}
const money=n=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN',maximumFractionDigits:0}).format(n);
const formatDate=date=>new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long'}).format(new Date(date+'T12:00:00'));
const serviceFor=id=>SERVICES.find(s=>s.id===id),resourceFor=id=>RESOURCES.find(r=>r.id===id);
let bookings=initialBookings(),category='Todos',step=1,selection={},month=today().slice(0,7);
function readSaved(){const saved=localStorage.getItem(storageKey);return saved===null?bookings:loadBookings(JSON.parse(saved));}
try{bookings=readSaved();}catch{/* Start from valid sample data if storage is unavailable. */}
function message(selector,text){$(selector).textContent=text;}
function save(next){bookings=next;try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{message('#booking-feedback','Los cambios se conservan en esta sesión; el navegador no permitió guardarlos.');}renderBookings();renderAdmin();}
function actionButton(label,handler,className='button outline'){const b=node('button',label,className);b.type='button';b.onclick=handler;return b;}
function statusBadge(status){return node('span',status,'badge '+status);}
function update(id,status){try{let current=bookings;try{current=readSaved();}catch{}save(updateStatus(current,id,status));message('#admin-feedback','Cita actualizada en esta demostración.');message('#booking-feedback','El estado de la cita se actualizó.');}catch(error){message('#admin-feedback',error.message);message('#booking-feedback',error.message);}}
function renderServices(){
 const list=$('#services');list.replaceChildren();const query=$('#service-search').value.trim().toLocaleLowerCase('es');
 const filtered=SERVICES.filter(s=>(category==='Todos'||s.category===category)&&(s.name+' '+s.description).toLocaleLowerCase('es').includes(query));
 $('#service-count').textContent=filtered.length+' servicios de ejemplo';$('#no-services').hidden=filtered.length>0;
 for(const s of filtered){
  const card=node('article',undefined,'service-card'),art=node('div',undefined,'service-art');art.append(icon(s.icon));
  const content=node('div',undefined,'service-card-content');content.append(node('span',s.category,'category-label'),node('h3',s.name),node('p',s.description));
  const meta=node('div',undefined,'service-meta');meta.append(node('span','◷ '+s.duration+' minutos'),node('span',s.resources.length+' profesionales'));
  const bottom=node('div',undefined,'service-bottom'),price=node('div',undefined,'price');price.append(node('strong',money(s.price)),node('small','IMPORTE DE EJEMPLO'));bottom.append(price,actionButton('Reservar cita →',()=>openBooking(s.id),'button primary'));content.append(meta,bottom);card.append(art,content);list.append(card);
 }
}
for(const name of ['Todos',...new Set(SERVICES.map(s=>s.category))]){const button=actionButton(name,()=>{category=name;for(const b of $('#categories').children){b.classList.toggle('active',b.textContent===name);b.setAttribute('aria-pressed',String(b.textContent===name));}renderServices();},name==='Todos'?'active':'');button.setAttribute('aria-pressed',String(name==='Todos'));$('#categories').append(button);}
$('#service-search').addEventListener('input',renderServices);
for(const resource of RESOURCES){
 const card=node('div',undefined,'professional');card.append(node('span',resource.initials,'avatar'));const body=node('div');body.append(node('strong',resource.name.split(' · ')[0]),node('small','Perfil ficticio · '+SERVICES.filter(s=>s.resources.includes(resource.id)).length+' servicios de ejemplo'));card.append(body);$('#professionals').append(card);
 const option=node('option',resource.name.split(' · ')[0]);option.value=resource.id;$('#admin-resource').append(option);
}
for(let n=0;n<7;n++){const date=addDays(today(),n),day=new Date(date+'T12:00:00'),box=node('div',undefined,n===1?'chosen':'');box.append(node('span',new Intl.DateTimeFormat('es-PE',{weekday:'short'}).format(day).replace('.','').toUpperCase()),node('strong',String(day.getDate())));$('#hero-week').append(box);}
function renderBookings(){
 const root=$('#my-bookings');root.replaceChildren();const q=$('#booking-search').value.trim().toLowerCase(),status=$('#booking-status').value;
 const filtered=[...bookings].reverse().filter(b=>(!status||b.status===status)&&[b.name,b.id,serviceFor(b.service).name].some(v=>v.toLowerCase().includes(q)));
 if(!filtered.length){root.append(node('p','No hay citas con esos filtros. Puedes crear una desde el catálogo.','empty'));return;}
 for(const booking of filtered){
  const card=node('article',undefined,'booking-card'),header=node('div',undefined,'booking-card-head');header.append(node('small',booking.id),statusBadge(booking.status));card.append(header,node('h3',serviceFor(booking.service).name),node('p',formatDate(booking.date)+' · '+booking.time+' – '+timeLabel(minutes(booking.time)+booking.duration)),node('p',resourceFor(booking.resource).name),node('small','A nombre de '+booking.name));
  if(['Pendiente','Confirmada'].includes(booking.status))card.append(node('p'),actionButton('Cancelar cita de ejemplo',()=>update(booking.id,'Cancelada')));
  root.append(card);
 }
}
function renderAdmin(){
 const stats=$('#admin-stats');stats.replaceChildren();for(const [label,value]of [['Citas registradas',bookings.length],['Pendientes',bookings.filter(b=>b.status==='Pendiente').length],['Confirmadas',bookings.filter(b=>b.status==='Confirmada').length],['Completadas',bookings.filter(b=>b.status==='Completada').length]]){const card=node('div',undefined,'stat');card.append(node('small',label),node('strong',String(value)));stats.append(card);}
 const date=$('#admin-date').value,resource=$('#admin-resource').value,status=$('#admin-status').value;
 const filtered=bookings.filter(b=>(!date||b.date===date)&&(!resource||b.resource===resource)&&(!status||b.status===status)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const body=$('#admin-rows');body.replaceChildren();$('#admin-empty').hidden=filtered.length>0;$('#admin-count').textContent=filtered.length+' citas en esta vista';
 for(const b of filtered){const tr=node('tr'),time=node('td');time.append(node('strong',b.time),node('small',b.date.split('-').reverse().join('/')));const service=node('td');service.append(node('strong',serviceFor(b.service).name),node('small',b.name+' · '+b.id));const badge=node('td');badge.append(statusBadge(b.status));const actions=node('td');if(b.status==='Pendiente')actions.append(actionButton('Confirmar',()=>update(b.id,'Confirmada')));if(b.status==='Confirmada')actions.append(actionButton('Completar',()=>update(b.id,'Completada')));if(['Pendiente','Confirmada'].includes(b.status))actions.append(actionButton('Cancelar',()=>update(b.id,'Cancelada')));if(!actions.children.length)actions.textContent='Cita cerrada';tr.append(time,service,node('td',resourceFor(b.resource).name.split(' · ')[0]),badge,actions);body.append(tr);}
}
function route(){const view=location.hash.slice(1);$('#catalog-view').hidden=['mis-citas','panel'].includes(view);$('#bookings-view').hidden=view!=='mis-citas';$('#admin-view').hidden=view!=='panel';for(const a of document.querySelectorAll('[data-view]')){a.classList.toggle('active',a.dataset.view===view);if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}if(['mis-citas','panel'].includes(view))window.scrollTo({top:0,behavior:'instant'});else if(view==='catalogo')requestAnimationFrame(()=>$('#catalogo').scrollIntoView({behavior:'smooth'}));}
window.addEventListener('hashchange',route);
for(const selector of ['#booking-search','#booking-status'])$(selector).addEventListener('input',renderBookings);
for(const selector of ['#admin-date','#admin-resource','#admin-status'])$(selector).addEventListener('change',renderAdmin);
$('#all-dates').onclick=()=>{$('#admin-date').value='';renderAdmin();};
$('#reset-demo').onclick=()=>{if(!confirm('¿Restablecer los datos de esta demo? Solo se eliminarán tus cambios de ejemplo en este navegador.'))return;$('#booking-search').value='';$('#booking-status').value='';$('#admin-date').value='';$('#admin-resource').value='';$('#admin-status').value='';save(initialBookings());message('#admin-feedback','Datos de demostración restablecidos.');message('#booking-feedback','');};
function summary(){
 const service=serviceFor(selection.service);$('#summary-service').textContent=service.name;$('#summary-description').textContent=service.description;$('#summary-price').textContent=money(service.price);$('#summary-icon').replaceChildren(icon(service.icon));
 const list=$('#summary-details');list.replaceChildren();for(const [label,value]of [['Duración',service.duration+' minutos'],['Profesional',resourceFor(selection.resource).name.split(' · ')[0]],['Día',selection.date?formatDate(selection.date):'Por seleccionar'],['Horario',selection.time||'Por seleccionar']])list.append(node('dt',label),node('dd',value));
}
function renderCalendar(){
 const [year,mon]=month.split('-').map(Number),first=new Date(year,mon-1,1),last=new Date(year,mon,0).getDate();
 $('#month-label').textContent=new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric'}).format(first);
 $('#prev-month').disabled=month<=today().slice(0,7);$('#next-month').disabled=month>=addDays(today(),90).slice(0,7);
 const grid=$('#calendar-grid');grid.replaceChildren();for(let i=0;i<(first.getDay()+6)%7;i++)grid.append(node('span'));
 for(let day=1;day<=last;day++){const date=`${year}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`,button=actionButton(String(day),()=>{selection.date=date;selection.time='';renderCalendar();summary();},date===selection.date?'selected':'');button.disabled=slotsFor(selection.service,selection.resource,date,bookings).length===0;button.setAttribute('aria-label',formatDate(date));button.setAttribute('aria-pressed',String(date===selection.date));button.dataset.date=date;grid.append(button);}
}
function renderSlots(){const root=$('#slots');root.replaceChildren();const available=slotsFor(selection.service,selection.resource,selection.date,bookings);$('#selected-date-label').textContent=formatDate(selection.date)+' · '+resourceFor(selection.resource).name.split(' · ')[0];$('#empty-slots').hidden=available.length>0;const service=serviceFor(selection.service);for(const time of available){const b=actionButton(time+' – '+timeLabel(minutes(time)+service.duration),()=>{selection.time=time;renderSlots();summary();},selection.time===time?'selected':'');b.setAttribute('aria-pressed',String(selection.time===time));b.dataset.time=time;root.append(b);}}
function showStep(){for(const section of document.querySelectorAll('[data-step]'))section.hidden=Number(section.dataset.step)!==step;for(const [i,item]of [...$('#steps').children].entries()){item.className=i+1===step?'current':i+1<step?'done':'';if(i+1===step)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');}$('#back-step').hidden=step===1;$('#next-step').textContent=['Ver horarios →','Continuar →','Revisar reserva →','Confirmar cita de ejemplo'][step-1];message('#wizard-error','');if(step===1)renderCalendar();if(step===2)renderSlots();if(step===4){const root=$('#confirmation');root.replaceChildren();for(const [label,value]of [['Servicio',serviceFor(selection.service).name],['Profesional',resourceFor(selection.resource).name.split(' · ')[0]],['Día',formatDate(selection.date)],['Hora',selection.time],['Nombre',$('#customer-name').value],['Correo',$('#customer-email').value],['Importe de ejemplo',money(serviceFor(selection.service).price)]]){const row=node('p');row.append(node('span',label),node('strong',value));root.append(row);}}summary();}
function openBooking(serviceId){const service=serviceFor(serviceId);step=1;selection={service:serviceId,resource:service.resources[0],date:'',time:''};for(let i=0;i<90;i++){const date=addDays(today(),i);if(slotsFor(serviceId,selection.resource,date,bookings).length){selection.date=date;break;}}month=(selection.date||today()).slice(0,7);const select=$('#resource-select');select.replaceChildren();for(const id of service.resources){const r=resourceFor(id),option=node('option',r.name);option.value=id;select.append(option);}$('#booking-form').reset();select.value=selection.resource;showStep();$('#booking-dialog').showModal();}
$('#resource-select').onchange=()=>{selection.resource=$('#resource-select').value;selection.time='';renderCalendar();summary();};
for(const [selector,offset]of [['#prev-month',-1],['#next-month',1]])$(selector).onclick=()=>{const d=new Date(month+'-01T12:00:00');d.setMonth(d.getMonth()+offset);month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;renderCalendar();};
$('#close-dialog').onclick=()=>$('#booking-dialog').close();$('#back-step').onclick=()=>{step=Math.max(1,step-1);showStep();};
$('#booking-form').addEventListener('submit',event=>{
 event.preventDefault();message('#wizard-error','');
 try{
  if(step===1){if(!selection.date||!slotsFor(selection.service,selection.resource,selection.date,bookings).length)throw new Error('Selecciona un día con horarios disponibles.');step=2;showStep();return;}
  if(step===2){if(!selection.time)throw new Error('Selecciona un horario para continuar.');step=3;showStep();return;}
  const input={...selection,name:$('#customer-name').value,email:$('#customer-email').value,note:$('#customer-note').value};
  if(step===3){createBooking(bookings,input,'DEMO-CHECK');step=4;showStep();return;}
  let current=bookings;try{current=readSaved();}catch{}
  const id='DEMO-'+crypto.randomUUID().slice(0,8).toUpperCase();save(createBooking(current,input,id));$('#booking-dialog').close();location.hash='mis-citas';route();message('#booking-feedback','Cita de ejemplo creada: '+id+'. Puedes gestionarla desde el panel de agenda.');
 }catch(error){message('#wizard-error',error.message);}
});
window.addEventListener('storage',event=>{if(event.key===storageKey){try{bookings=readSaved();renderBookings();renderAdmin();if($('#booking-dialog').open){if(step===1)renderCalendar();if(step===2)renderSlots();}}catch{}}});
renderServices();renderBookings();renderAdmin();route();
