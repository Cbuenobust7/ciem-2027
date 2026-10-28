export const SERVICES = [
 {id:'consultoria',name:'Asesoría para tu negocio',category:'Profesionales',duration:60,price:90,icon:'briefcase',resources:['valeria','diego'],description:'Una cita para organizar ideas y revisar los próximos pasos de un proyecto.'},
 {id:'bienestar',name:'Sesión de bienestar',category:'Bienestar',duration:45,price:70,icon:'spark',resources:['valeria','lucia'],description:'Un ejemplo de servicio personal con duración y agenda definidas.'},
 {id:'estilismo',name:'Corte y estilismo',category:'Belleza',duration:60,price:65,icon:'scissors',resources:['lucia','valeria'],description:'Reserva un espacio de atención y elige al profesional disponible.'},
 {id:'soporte',name:'Asesoría tecnológica',category:'Profesionales',duration:90,price:120,icon:'monitor',resources:['diego'],description:'Un espacio para evaluar una necesidad digital y sus posibles soluciones.'},
 {id:'limpieza',name:'Limpieza de oficina',category:'Servicios',duration:120,price:150,icon:'home',resources:['diego','lucia'],description:'Un flujo inspirado en MasterClean Connect para coordinar una visita.'},
 {id:'sesion',name:'Sesión personalizada',category:'Bienestar',duration:30,price:45,icon:'calendar',resources:['valeria','lucia'],description:'Un ejemplo de cita breve para adaptar a tu especialidad.'},
];
export const RESOURCES=[{id:'valeria',name:'Valeria · profesional demo',initials:'VA'},{id:'diego',name:'Diego · profesional demo',initials:'DI'},{id:'lucia',name:'Lucía · profesional demo',initials:'LU'}];
export const STATUSES=['Pendiente','Confirmada','Completada','Cancelada'];
export function limaParts(now=new Date()) {return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));}
export function today(now=new Date()){const p=limaParts(now);return `${p.year}-${p.month}-${p.day}`;}
export function addDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function minutes(time){return Number(time.slice(0,2))*60+Number(time.slice(3));}
export function timeLabel(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
export function validDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return false;const d=new Date(date+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date;}
export function slotsFor(serviceId,resourceId,date,bookings=[],now=new Date()){
 const service=SERVICES.find(s=>s.id===serviceId);
 if(!service||!service.resources.includes(resourceId)||!validDate(date)||date<today(now)||date>addDays(today(now),90)||new Date(date+'T12:00:00Z').getUTCDay()===0)return [];
 const p=limaParts(now),current=Number(p.hour)*60+Number(p.minute),result=[];
 for(let start=9*60;start+service.duration<=18*60;start+=30){
  const end=start+service.duration;
  if(start<14*60&&end>13*60)continue;
  if(date===today(now)&&start<=current)continue;
  if(bookings.some(b=>b.resource===resourceId&&b.date===date&&b.status!=='Cancelada'&&start<minutes(b.time)+b.duration&&end>minutes(b.time)))continue;
  result.push(timeLabel(start));
 }
 return result;
}
export function initialBookings(now=new Date()){
 let date=addDays(today(now),1);while(new Date(date+'T12:00:00Z').getUTCDay()===0)date=addDays(date,1);
 return [
 {id:'DEMO-1001',service:'consultoria',resource:'valeria',date,time:'10:00',duration:60,name:'Cliente de ejemplo A',email:'demo-a@example.com',note:'Primera reunión de ejemplo.',status:'Confirmada'},
 {id:'DEMO-1002',service:'estilismo',resource:'lucia',date,time:'11:00',duration:60,name:'Cliente de ejemplo B',email:'demo-b@example.com',note:'',status:'Pendiente'},
 {id:'DEMO-1003',service:'soporte',resource:'diego',date,time:'14:00',duration:90,name:'Cliente de ejemplo C',email:'demo-c@example.com',note:'Revisión de proyecto de ejemplo.',status:'Confirmada'},
 ];
}
export function createBooking(bookings,input,id,now=new Date()){
 if(bookings.length>=100)throw new Error('La demo admite 100 citas. Restablece los datos para continuar.');
 const service=SERVICES.find(s=>s.id===input.service);
 if(!service||!service.resources.includes(input.resource))throw new Error('Selecciona un servicio y un profesional.');
 if(!slotsFor(input.service,input.resource,input.date,bookings,now).includes(input.time))throw new Error('Ese horario ya no está disponible. Selecciona otro.');
 const name=String(input.name||'').trim(),email=String(input.email||'').trim(),note=String(input.note||'').trim();
 if(!name||name.length>80)throw new Error('Escribe un nombre de ejemplo de hasta 80 caracteres.');
 if(email.length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Escribe un correo de ejemplo válido.');
 if(note.length>300)throw new Error('La nota admite hasta 300 caracteres.');
 if(bookings.some(b=>b.id===id))throw new Error('La referencia ya existe.');
 return [...bookings,{id,service:service.id,resource:input.resource,date:input.date,time:input.time,duration:service.duration,name,email,note,status:'Pendiente'}];
}
export function updateStatus(bookings,id,status){
 if(!bookings.some(b=>b.id===id))throw new Error('No se encontró la cita.');
 return bookings.map(b=>{
  if(b.id!==id)return b;
  const allowed=b.status==='Pendiente'?['Confirmada','Cancelada']:b.status==='Confirmada'?['Completada','Cancelada']:[];
  if(!allowed.includes(status))throw new Error('Esta cita ya está cerrada o el cambio no es válido.');
  return {...b,status};
 });
}
export function loadBookings(value){
 if(!Array.isArray(value)||value.length>100)throw new Error('Datos inválidos.');
 const seen=new Set();
 return value.map(b=>{
  const service=SERVICES.find(s=>s.id===b?.service);
  if(!service||!service.resources.includes(b.resource)||typeof b.id!=='string'||seen.has(b.id)||!validDate(b.date)||!/^(?:09|1[0-7]):(?:00|30)$/.test(b.time)||!STATUSES.includes(b.status)||typeof b.name!=='string'||!b.name.trim()||b.name.length>80||typeof b.email!=='string'||b.email.length>150||typeof b.note!=='string'||b.note.length>300||!Number.isInteger(minutes(b.time))||minutes(b.time)<540||minutes(b.time)+service.duration>1080)throw new Error('Reserva inválida.');
  seen.add(b.id);return {id:b.id,service:b.service,resource:b.resource,date:b.date,time:b.time,duration:service.duration,name:b.name,email:b.email,note:b.note,status:b.status};
 });
}
