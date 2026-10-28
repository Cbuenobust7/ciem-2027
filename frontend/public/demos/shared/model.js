export const MODES = {
  'crm-comercial': { title: 'CRM comercial', subtitle: 'De la primera consulta a la oportunidad ganada.', singular: 'oportunidad', stages: ['Nuevo', 'En contacto', 'Propuesta', 'Ganado'], fields: [['name','Empresa o proyecto','text'],['amount','Valor estimado (S/)','number']] },
  'gestion-inventario': { title: 'Control de inventario', subtitle: 'Productos, existencias y movimientos en un solo lugar.', singular: 'producto', stages: [], fields: [['name','Nombre del producto','text'],['sku','Código SKU','text'],['quantity','Stock inicial','number'],['amount','Costo unitario (S/)','number']] },
  'plataforma-reservas': { title: 'Agenda de reservas', subtitle: 'Organiza solicitudes y confirma tus próximas citas.', singular: 'reserva', stages: ['Pendiente', 'Confirmada', 'Completada', 'Cancelada'], fields: [['name','Nombre de ejemplo','text'],['service','Servicio','select'],['date','Fecha','date'],['time','Hora','select']] },
};
export function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function futureDate(offset=1) { const d = new Date(); d.setDate(d.getDate()+offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function initialData(mode) {
 if (mode==='crm-comercial') return [{id:'1',name:'Estudio Aurora',amount:2400,status:'Nuevo'},{id:'2',name:'Café del Parque',amount:1800,status:'En contacto'},{id:'3',name:'Taller Norte',amount:4200,status:'Propuesta'},{id:'4',name:'Proyecto Horizonte',amount:3200,status:'Ganado'}];
 if (mode==='gestion-inventario') return [{id:'1',name:'Cuaderno A5',sku:'PAP-001',quantity:24,amount:12},{id:'2',name:'Botella térmica',sku:'ACC-002',quantity:4,amount:38},{id:'3',name:'Bolígrafo azul',sku:'PAP-003',quantity:50,amount:3.5},{id:'4',name:'Organizador de escritorio',sku:'ACC-004',quantity:0,amount:24}];
 return [{id:'1',name:'Cliente de ejemplo A',service:'Asesoría',date:futureDate(),time:'10:00',status:'Pendiente'},{id:'2',name:'Cliente de ejemplo B',service:'Reunión de proyecto',date:futureDate(),time:'14:00',status:'Confirmada'},{id:'3',name:'Cliente de ejemplo C',service:'Consulta inicial',date:futureDate(2),time:'11:00',status:'Pendiente'}];
}
function money(value) { const n=Number(value); if (String(value).trim()==='' || !Number.isFinite(n) || n<0 || n>10000000) throw new Error('Ingresa un importe válido entre 0 y 10 000 000.'); return Math.round(n*100)/100; }
export function addRecord(mode, records, input, id) {
 if(!MODES[mode]) throw new Error('Demo inválida.');
 if(records.length>=100) throw new Error('La demo admite hasta 100 registros. Restablece los datos para continuar.');
 const name=String(input.name||'').trim(); if(!name || name.length>100) throw new Error('Escribe un nombre de hasta 100 caracteres.');
 const row={id:String(id),name};
 if(mode==='crm-comercial') Object.assign(row,{amount:money(input.amount),status:'Nuevo'});
 if(mode==='gestion-inventario') {
  const sku=String(input.sku||'').trim().toUpperCase(); if(!/^[A-Z0-9_-]{1,24}$/.test(sku)) throw new Error('Usa un SKU de hasta 24 letras, números, guiones o guiones bajos.');
  if(records.some(r=>r.sku===sku)) throw new Error('Ese SKU ya está registrado.');
  const quantity=Number(input.quantity); if(String(input.quantity).trim()==='' || !Number.isInteger(quantity) || quantity<0 || quantity>100000) throw new Error('El stock debe ser un entero entre 0 y 100 000.');
  Object.assign(row,{sku,quantity,amount:money(input.amount)});
 }
 if(mode==='plataforma-reservas') {
  if(!['Asesoría','Reunión de proyecto','Consulta inicial'].includes(input.service)) throw new Error('Selecciona un servicio.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date||'') || !Number.isFinite(Date.parse(input.date)) || new Date(input.date+'T12:00:00Z').toISOString().slice(0,10)!==input.date || input.date<today()) throw new Error('Selecciona una fecha válida desde hoy.');
  if(!['09:00','10:00','11:00','14:00','15:00','16:00'].includes(input.time)) throw new Error('Selecciona un horario.');
  if(records.some(r=>r.date===input.date&&r.time===input.time&&r.status!=='Cancelada')) throw new Error('Ese horario ya está ocupado. Elige otro.');
  Object.assign(row,{service:input.service,date:input.date,time:input.time,status:'Pendiente'});
 }
 return [...records,row];
}
export function changeRecord(mode,records,id,action) {
 return records.map(row=>{
  if(row.id!==id) return row;
  if(mode==='gestion-inventario') {
   if(!['plus','minus'].includes(action)) throw new Error('Movimiento inválido.');
   const quantity=row.quantity+(action==='plus'?1:-1);
   if(quantity<0) throw new Error('No hay stock disponible para registrar una salida.');
   if(quantity>100000) throw new Error('Se alcanzó el límite de stock de la demo.');
   return {...row,quantity};
  }
  if(action==='cancel' && mode==='plataforma-reservas') {
   if(['Completada','Cancelada'].includes(row.status)) throw new Error('La reserva ya está cerrada.');
   return {...row,status:'Cancelada'};
  }
  const stages=mode==='plataforma-reservas'?['Pendiente','Confirmada','Completada']:MODES[mode].stages;
  const index=stages.indexOf(row.status);
  if(action!=='advance'||index<0||index===stages.length-1) throw new Error('El registro ya está en su etapa final.');
  return {...row,status:stages[index+1]};
 });
}
export function matching(records,search='',status='') { const q=search.trim().toLocaleLowerCase('es'); return records.filter(r=>(!status||r.status===status)&&[r.name,r.sku,r.service].filter(Boolean).some(v=>v.toLocaleLowerCase('es').includes(q))); }
export function restoreRecords(mode,value) {
 if(!Array.isArray(value)||value.length>100) throw new Error('Datos inválidos.');
 const result=[];
 for(const row of value) {
  if(!row||typeof row.id!=='string'||result.some(r=>r.id===row.id)) throw new Error('Registro inválido.');
  // Validate stored records without rejecting previously booked dates.
  const input=mode==='plataforma-reservas'?{...row,date:futureDate(3),time:['09:00','10:00','11:00','14:00','15:00','16:00'][result.length%6]}:row;
  const validated=addRecord(mode,mode==='plataforma-reservas'?[]:result,input,row.id).at(-1);
  if(mode!=='gestion-inventario') {
   if(!MODES[mode].stages.includes(row.status)) throw new Error('Etapa inválida.');
   validated.status=row.status;
  }
  if(mode==='plataforma-reservas') {
   if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date||'')||!['09:00','10:00','11:00','14:00','15:00','16:00'].includes(row.time)) throw new Error('Reserva inválida.');
   validated.date=row.date; validated.time=row.time;
  }
  result.push(validated);
 }
 return result;
}
