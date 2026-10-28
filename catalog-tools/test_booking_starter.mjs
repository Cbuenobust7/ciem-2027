import test from 'node:test';
import assert from 'node:assert/strict';
import {SERVICES,slotsFor,initialBookings,createBooking,updateStatus,loadBookings,today,addDays,minutes} from '../frontend/public/booking-starter-kit/model.js';
const now=new Date('2026-11-02T12:00:00Z');
const input={service:'consultoria',resource:'valeria',date:'2026-11-02',time:'10:00',name:'Cliente de ejemplo',email:'demo@example.com',note:''};
test('Agenda: zona de Lima, domingos, fechas pasadas y horizonte',()=>{
 assert.equal(today(new Date('2026-11-02T02:00:00Z')),'2026-11-01');
 for(const date of ['2026-11-01','2026-11-08','2026-02-31',addDays(today(now),91)])assert.deepEqual(slotsFor('consultoria','valeria',date,[],now),[]);
 assert.deepEqual(slotsFor('consultoria','no-existe','2026-11-02',[],now),[]);
});
test('Agenda: respeta duración, apertura, cierre y pausa',()=>{
 for(const service of SERVICES){
  const slots=slotsFor(service.id,service.resources[0],'2026-11-02',[],now);assert.ok(slots.length);
  assert.ok(slots.every(time=>{const start=minutes(time),end=start+service.duration;return start>=540&&end<=1080&&(end<=780||start>=840);}));
 }
 assert.ok(!slotsFor('consultoria','valeria','2026-11-02',[],new Date('2026-11-02T15:15:00Z')).includes('10:00'));
});
test('Reservar: impide solapamientos entre servicios del mismo profesional',()=>{
 const booked=createBooking([],input,'DEMO-TEST',now);
 assert.throws(()=>createBooking(booked,{...input,service:'bienestar',time:'10:30'},'DEMO-SECOND',now));
 assert.equal(createBooking(booked,{...input,time:'11:00'},'DEMO-SECOND',now).length,2);
 assert.equal(createBooking(booked,{...input,resource:'diego'},'DEMO-SECOND',now).length,2);
});
test('Estados: confirma, completa y evita reabrir citas cerradas',()=>{
 let rows=createBooking([],input,'DEMO-TEST',now);assert.equal(rows[0].status,'Pendiente');
 rows=updateStatus(rows,'DEMO-TEST','Confirmada');rows=updateStatus(rows,'DEMO-TEST','Completada');
 assert.throws(()=>updateStatus(rows,'DEMO-TEST','Cancelada'));
 assert.throws(()=>updateStatus(rows,'NO-EXISTE','Confirmada'));
});
test('Cancelar libera el horario y los cambios no mutan el registro original',()=>{
 const rows=createBooking([],input,'DEMO-TEST',now),next=updateStatus(rows,'DEMO-TEST','Cancelada');
 assert.equal(rows[0].status,'Pendiente');assert.equal(next[0].status,'Cancelada');
 assert.ok(slotsFor(input.service,input.resource,input.date,next,now).includes(input.time));
});
test('Datos: correo, nombre, nota, referencia y límites',()=>{
 for(const invalid of [{name:''},{email:'incorrecto'},{note:'x'.repeat(301)},{time:'09:99'},{resource:'lucia'}])assert.throws(()=>createBooking([],{...input,...invalid},'DEMO-TEST',now));
 const rows=createBooking([],input,'DEMO-TEST',now);
 assert.throws(()=>createBooking(rows,{...input,time:'11:00'},'DEMO-TEST',now));
 assert.throws(()=>createBooking(Array(100).fill(rows[0]),input,'X',now));
});
test('Persistencia: restaura datos válidos y rechaza referencias duplicadas o servicios inválidos',()=>{
 const rows=initialBookings(now);assert.deepEqual(loadBookings(JSON.parse(JSON.stringify(rows))),rows);
 assert.throws(()=>loadBookings([rows[0],rows[0]]));assert.throws(()=>loadBookings([{...rows[0],service:'otro'}]));assert.throws(()=>loadBookings({}));
});
